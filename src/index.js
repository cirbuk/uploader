import { getUploadPacket } from './packet';
import FlowManager from './flowmanager';
import {isValidString, isUndefined, isFunction} from "@kubric/utils";
import { events as uploaderEvents } from "./constants";
import { uploadTaskReducer, chunkTaskReducer } from './reducer';
import { getFileEntries, getHumanFileSize, promiseSerial, uuid, getFilesFromFileEntries, getExtension } from "./util";

const MIN_CHUNKSIZE = 52428800;
const MAX_CHUNKSIZE = 104857600;

export const events = uploaderEvents;
export { getFileEntries, getUploadPacket, uuid, getFilesFromFileEntries, getExtension };

const addFileSizes = files => {
  return Promise.all(files.map(file => {
    return new Promise(resolveFile => {
      if (file.size) {
        file['_parsedSize'] = getHumanFileSize(file.size);
        resolveFile(file);
      } else {
        file.file(fl => {
          file['_parsedSize'] = getHumanFileSize(fl.size)
          resolveFile(file);
        });
      }
    })
  }))
}

const validateDataTransfer = (obj = {}) => {
  if (obj.items instanceof DataTransferItemList) {
    if (obj.items[0].webkitGetAsEntry()?.isFile && obj.items.length === 1) {
      return {
        type: "droppedFile",
        files: [obj.files[0]]
      };
    } else {
      return {
        type: "dropped",
        files: obj.items
      }
    }
  }
};

const parseInput = obj => {
  const dtResults = validateDataTransfer(obj);
  if (isUndefined(obj)) {
    return false;
  } else if (!isUndefined(dtResults)) {
    //checking if the input is already a data transfer object
    return dtResults;
  } else if (obj.dataTransfer) {
    //Checking if it is an event object passed directly from the drop event
    return validateDataTransfer(obj.dataTransfer);
  } else if (obj.target && obj.target.files && obj.target.files.length > 0) {
    //Checking if it is an event object passed from the input element
    return {
      type: "selected",
      files: obj.target.files
    };
  } else if (obj.length > 0) {
    //Checking if it is file list extracted from the event and passed
    return {
      type: "selected",
      files: obj
    };
  }
  return false;
}

export class Uploader {
  static init({
                chunking: {
                  enable = false,
                  min = MIN_CHUNKSIZE,
                  max = MAX_CHUNKSIZE
                } = {},
                urls: { getUploadUrl, createFolder } = {}
              } = {}) {
    if (!isValidString(getUploadUrl) && !isFunction(getUploadUrl)) {
      throw new Error(`"urls.getUploadUrl" is a mandatory config option.`);
    }
    FlowManager.init({
      chunking: {
        enable,
        min,
        max
      },
      urls: {
        getUploadUrl,
        createFolder
      }
    });
    Uploader.initialized = true;
  }

  static getTotalProgress(taskList) {
    const sum = taskList && taskList.length && taskList.reduce((acc, task) => acc += task.progress, 0);
    return sum ? sum / taskList.length : 0;
  }


  constructor({ targetFolderId = "/root", token, isPublic = false, tags = [] } = {}) {
    this.targetFolderId = targetFolderId;
    this.getQueuedTasksProgress = this.getQueuedTasksProgress.bind(this);
    this.getChunkTasksProgress = this.getChunkTasksProgress.bind(this);
    this.manager = new FlowManager(token, isPublic, this.getQueuedTasksProgress, this.getChunkTasksProgress);
    this.manager.on("ALL_UPLOADER", this.setUploaderData.bind(this));
    this.manager.on("CHUNK_TASK", this.setChunkTaskData.bind(this));
    this.uploaderData = [];
    this.uploaderDataObj = {
      totalData: [],
      clearedData: []
    }
    this.chunkTaskData = [];
    this.tags = tags;
  }

  getChunkTasksProgress(taskId) {
    const task = this.chunkTaskData.filter(task => task.taskId === taskId);
    return task[0] ? Uploader.getTotalProgress(task[0].chunkTasks) : 0;
  }

  getQueuedTasksProgress() {
    const tasks = this.uploaderDataObj.totalData.filter((data) => {
      return !data.isComplete && !data.isError;
    });
    return Uploader.getTotalProgress(tasks);
  }

  setUploaderData(obj) {
    this.uploaderDataObj.totalData = uploadTaskReducer(this.uploaderDataObj.totalData, obj);
  }

  setChunkTaskData(obj) {
    this.chunkTaskData = chunkTaskReducer(this.chunkTaskData, obj);
  }

  clearStats() {
    this.uploaderDataObj.clearedData = [...this.uploaderDataObj.clearedData, ...this.uploaderData];
    this.uploaderData = [];
  }

  getStats() {
    this.uploaderData = this.uploaderDataObj.totalData.filter(
      (data) => !this.uploaderDataObj.clearedData.includes(data)
    );
    return this.uploaderData;
  }

  on(event, handler) {
    return this.manager.on(event, handler);
  }

  onNewUploadPacket(uploadPacket, payload) {
    const { targetFolderId, tags } = this;
    return promiseSerial(
      uploadPacket.map(pack => () => {
        const { folder } = pack;
        return new Promise(resolve => {
          if (folder.uploadInTargetFolder) {
            //? If no folder needs to be created, skip createFolderFlow
            resolve({
              id: targetFolderId
            });
            return this.manager.uploadFilesFlow({ id: targetFolderId }, pack.files, tags, payload);
          }
          let folderIdForNewFolder = FlowManager.folderIdForPathCache[folder.onlyPath] || targetFolderId;

          this.manager.createFolderFlowForPacket(pack, folderIdForNewFolder, (err, eventData) => {
            if (eventData) {
              resolve(eventData.folderCreated);
            }
          }, payload);
        });
      }));
  }

  static getFiles(obj) {
    const results = parseInput(obj);
    if (results) {
      const { type, files = [] } = results;
      if (type === "dropped" && files.length > 0) {
        return getUploadPacket(files)
          .then((entries = []) => entries.reduce((acc, { files = [] }) => [...acc, ...files], []))
          .then(addFileSizes);
      } else {
        const filesArr = [];
        for (let i = 0; i < files.length; i++) {
          filesArr[i] = files[i];
        }
        return Promise.resolve(addFileSizes(filesArr));
      }
    }
    return Promise.reject("Invalid object");
  }

  // Any of the below 3 can be passed here
  // 1. Pass an event object directly from the HTML file input
  // 2. event.dataTransfer object where event is drop event object
  // 3. event.files object where event is the file changed event object in an HTML file input
  // Any data object with a `payload` can be passed as 2nd argument, This payload will be attached to the fired event
  // data
  upload(obj, { payload } = {}) {
    if (!Uploader.initialized) {
      throw new Error("Uploader not initialized");
    }

    const results = parseInput(obj);
    if (results) {
      const { type, files = [] } = results;

      if (type === "dropped" && files.length > 0) {
        getUploadPacket(files, this.onNewUploadPacket.bind(this), payload);
      } else {
        // Convert FileList into FileEntries
        const fileEntries = getFileEntries(files);
        const packet = [{
          folder: {
            uploadInTargetFolder: true,
            name: '',
            fullPath: '/root',
            onlyPath: ''
          },
          files: fileEntries
        }];

        this.onNewUploadPacket(packet, payload);
      }
    }
  }
}

Uploader.initialized = false;
import { getUploadPacket } from './packet';
import FlowManager from './flowmanager';
import { isValidString, isUndefined } from "@kubric/litedash";
import { events as uploaderEvents } from "./constants";
import { uploadTaskReducer, chunkTaskReducer } from './reducer';
import { getHumanFileSize, promiseSerial } from "./util";

const MIN_CHUNKSIZE = 52428800;
const MAX_CHUNKSIZE = 104857600;

export const events = uploaderEvents;

const addFileSizes = files => {
  files.forEach(file => file._parsedSize = getHumanFileSize(file.size));
  return files;
}

const validateDataTransfer = (obj = {}) => {
  if (obj.items instanceof DataTransferItemList) {
    if (obj.items[0].webkitGetAsEntry().isFile && obj.items.length === 1) {
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
                },
                urls: { getUploadUrl, createFolder } = {}
              }) {
    if (!isValidString(getUploadUrl)) {
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


  constructor({ targetFolderId = "/root", token } = {}) {
    this.targetFolderId = targetFolderId;
    this.getQueuedTasksProgress = this.getQueuedTasksProgress.bind(this);
    this.getChunkTasksProgress = this.getChunkTasksProgress.bind(this);
    this.manager = new FlowManager(token, this.getQueuedTasksProgress, this.getChunkTasksProgress);
    this.manager.on("ALL_UPLOADER", this.setUploaderData.bind(this));
    this.manager.on("CHUNK_TASK", this.setChunkTaskData.bind(this));
    this.uploaderData = [];
    this.uploaderDataObj = {
      totalData: [],
      clearedData: []
    }
    this.chunkTaskData = [];
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

  onNewUploadPacket(uploadPacket) {
    const { targetFolderId } = this;
    return promiseSerial(
      uploadPacket.map(pack => () => {
        const { folder } = pack;
        return new Promise(resolve => {
          if (folder.uploadInTargetFolder) {
            //? If no folder needs to be created, skip createFolderFlow
            resolve({
              id: targetFolderId
            });
            return this.manager.uploadFilesFlow({ id: targetFolderId }, pack.files);
          }
          let folderIdForNewFolder = FlowManager.folderIdForPathCache[folder.onlyPath] || targetFolderId;

          this.manager.createFolderFlowForPacket(pack, folderIdForNewFolder, (err, eventData) => {
            if (eventData) {
              resolve(eventData.folderCreated);
            }
          });
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
  upload(obj) {
    if (!Uploader.initialized) {
      throw new Error("Uploader not initialized");
    }
    const results = parseInput(obj);
    if (results) {
      const { type, files = [] } = results;
      if (type === "dropped" && files.length > 0) {
        getUploadPacket(files, this.onNewUploadPacket.bind(this));
      } else {
        const fileEntries = [];
        //? Convert FileList into FileEntries
        for (let i = 0; i < files.length; i++) {
          const fileEntry = files[i];
          fileEntry.file = callback => {
            callback(fileEntry);
          };
          fileEntries.push(fileEntry);
        }
        const packet = [{
          folder: {
            uploadInTargetFolder: true,
            name: '',
            fullPath: '/root',
            onlyPath: ''
          },
          files: fileEntries
        }];
        this.onNewUploadPacket(packet);
      }
    }
  }
}

Uploader.initialized = false;
import { getUploadPacket } from './packet';
import FlowManager from './flowmanager';
import { isValidString, isUndefined } from "@kubric/litedash";
import { promiseSerial } from "./util";
import { events as uploaderEvents, UploaderEvents } from "./constants";
import reducer from './reducer';

const MIN_CHUNKSIZE = 52428800;
const MAX_CHUNKSIZE = 104857600;

export const events = uploaderEvents;

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
                    enableChunking = false,
                    min = MIN_CHUNKSIZE,
                    max = MAX_CHUNKSIZE
                  },
                 urls: { getUploadUrl, createFolder } = {}
              }) {
    if (!isValidString(getUploadUrl)) {
      throw new Error(`"urls.getUploadUrl" is a mandatory config option.`);
    }
    FlowManager.init({
      chunking : {
          enableChunking,
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

  #uploaderData = [];

  constructor(targetFolderId = "/root") {
    this.targetFolderId = targetFolderId;
    this.manager = new FlowManager();
    this.manager.on("ALL_UPLOADER", this.setUploaderData.bind(this));
  }

  setUploaderData(obj) {
    this.#uploaderData = reducer(this.#uploaderData, obj)
  }

  stats() {
    return this.#uploaderData;
  }

  on(event, handler) {
    this.manager.on(event, handler);
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
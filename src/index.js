import { getUploadPacket } from './packet';
import FlowManager from './flowmanager';
import { get, isValidString } from "@kubric/litedash";
import { promiseSerial } from "./util";
import { isUndefined } from "../../litedash";

const MIN_CHUNKSIZE = 52428800;
const MAX_CHUNKSIZE = 104857600;

const validateDataTransfer = (obj = {}) => {
  if (Array.isArray(obj.items)) {
    if (obj.items[0].webkitGetAsEntry().isFile && obj.items.length === 1) {
      return {
        type: "dropped",
        files: [obj.files[0]]
      };
    } else {
      return {
        type: "dropped",
        files: obj.items
      }
    }
  }
  return false;
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
  } else if (obj.files && obj.files.length > 0) {
    //Checking if it is an event object passed from the input element
    return {
      type: "selected",
      files: obj.files
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
  static initialized = false;

  static init({
                chunking = {
                  enabled: false,
                  min: MIN_CHUNKSIZE,
                  max: MAX_CHUNKSIZE
                }, urls: { getUploadUrl, createFolder } = {}
              }) {
    if (!isValidString(getUploadUrl)) {
      throw new Error(`"urls.getUploadUrls" is a mandatory config option.`);
    } else if (!isValidString(createFolder)) {
      throw new Error(`"urls.createFolder" is a mandatory config option.`);
    }
    FlowManager.init({
      chunking,
      urls: {
        getUploadUrl,
        createFolder
      }
    });
    Uploader.initialized = true;
  }

  constructor(targetFolderId = "/root") {
    this.targetFolderId = targetFolderId;
    this.manager = new FlowManager(this.targetFolderId);
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
            return FlowManager.uploadFilesFlow({ id: targetFolderId }, pack.files, dispatch, urlObj, handlers, chunkingConfig);
          }
          let folderIdForNewFolder = FlowManager.folderIdForPathCache[folder.onlyPath] || targetFolderId;

          FlowManager.createFolderFlowForPacket(pack, folderIdForNewFolder, urlObj.folderCreationUrl, handlers, ({ type, payload }) => {
            if (type === "FOLDER_CREATED") {
              resolve(payload.folderCreated);
            }
            dispatch({ type, payload });
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

// const onNewUploadPacket = (targetFolderId, dispatch, urlObj, handlers, chunkingConfig, uploadPacket) =>
//   promiseSerial(
//     uploadPacket.map(pack => () => {
//       const { folder } = pack;
//       return new Promise(resolve => {
//         if (folder.uploadInTargetFolder) {
//           //? If no folder needs to be created, skip createFolderFlow
//           resolve({ id: targetFolderId });
//           return FlowManager.uploadFilesFlow({ id: targetFolderId }, pack.files, dispatch, urlObj, handlers, chunkingConfig);
//         }
//         const folderIdForNewFolder = FlowManager.folderIdForPathCache[folder.onlyPath] ?
//           FlowManager.folderIdForPathCache[folder.onlyPath] : targetFolderId;
//
//         UploadFlowManager.createFolderFlowForPacket(pack, folderIdForNewFolder, urlObj.folderCreationUrl, handlers, ({ type, payload }) => {
//           if (type === "FOLDER_CREATED") {
//             resolve(payload.folderCreated);
//           }
//           dispatch({ type, payload });
//         });
//       });
//     }));
//
// export const upload = ({ dataTransfer, files, targetFolderId, dispatch, urlObj, handlers, chunkingConfig }) => {
//   if (dataTransfer) {
//     if (dataTransfer.items.length === 1 && dataTransfer.items[0].webkitGetAsEntry().isFile) {
//       const files = [];
//       const fileEntry = dataTransfer.files[0];
//       fileEntry.file = callback => {
//         callback(fileEntry);
//       };
//       files.push(fileEntry);
//       const packet = [{
//         folder: {
//           uploadInTargetFolder: true,
//           name: '',
//           fullPath: '/root',
//           onlyPath: ''
//         },
//         files
//       }];
//       onNewUploadPacket(targetFolderId, dispatch, urlObj, handlers, chunkingConfig, packet);
//     } else {
//       getUploadPacket(dataTransfer.items, onNewUploadPacket.bind(null, targetFolderId, dispatch, urlObj, handlers, chunkingConfig));
//     }
//   } else if (files.length > 0) {
//     const fileEntries = [];
//     //? Convert FileList into FileEntries
//     for (let i = 0; i < files.length; i++) {
//       const fileEntry = files[i];
//       fileEntry.file = callback => {
//         callback(fileEntry);
//       };
//       fileEntries.push(fileEntry);
//     }
//     const packet = [{
//       folder: {
//         uploadInTargetFolder: true,
//         name: '',
//         fullPath: '/root',
//         onlyPath: ''
//       },
//       files: fileEntries
//     }];
//     onNewUploadPacket(targetFolderId, dispatch, urlObj, handlers, chunkingConfig, packet);
//   }
// };

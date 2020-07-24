import { getUploadPacket } from './packet';
import FlowManager from './flowmanager';

const promiseSerial = funcs =>
  funcs.reduce((promise, func) => promise.then(result => func().then(Array.prototype.concat.bind(result))), Promise.resolve([]));

const onNewUploadPacket = (targetFolderId, dispatch, urlObj, handlers, chunkingConfig, uploadPacket) =>
  promiseSerial(
    uploadPacket.map(pack => () => {
      const { folder } = pack;
      return new Promise(resolve => {
        if (folder.uploadInTargerFolder) {
          //? If no folder needs to be created, skip createFolderFlow
          resolve({ id: targetFolderId });
          return FlowManager.uploadFilesFlow({ id: targetFolderId }, pack.files, dispatch, urlObj, handlers, chunkingConfig);
        }
        const folderIdForNewFolder = FlowManager.folderIdForPathCache[folder.onlyPath] ?
          FlowManager.folderIdForPathCache[folder.onlyPath] : targetFolderId;

        UploadFlowManager.createFolderFlowForPacket(pack, folderIdForNewFolder, urlObj.folderCreationUrl, handlers, ({ type, payload }) => {
          if (type === "FOLDER_CREATED") {
            resolve(payload.folderCreated);
          }
          dispatch({ type, payload });
        });
      });
    }));

export const upload = (event, targetFolderId, dispatch, urlObj, handlers, chunkingConfig) => {
  if (event && event.type === 'drop') {
    const dataTransfer = event.dataTransfer;
    if (dataTransfer.items.length === 1 && dataTransfer.items[0].webkitGetAsEntry().isFile) {
      const files = [];
      const fileEntry = dataTransfer.files[0];
      fileEntry.file = callback => {
        callback(fileEntry);
      };
      files.push(fileEntry);
      const packet = [{
        folder: {
          uploadInTargerFolder: true,
          name: '',
          fullPath: '/root',
          onlyPath: ''
        },
        files
      }];
      onNewUploadPacket(targetFolderId, dispatch, urlObj, handlers, chunkingConfig, packet);
    } else {
      getUploadPacket(dataTransfer.items, onNewUploadPacket.bind(null, targetFolderId, dispatch, urlObj, handlers, chunkingConfig));
    }
  } else if (event && event.type === 'change') {
    const files = [];
    //? Convert FileList into FileEntries
    for (let i = 0; i < event.target.files.length; i++) {
      const fileEntry = event.target.files[i];
      fileEntry.file = callback => {
        callback(fileEntry);
      };
      files.push(fileEntry);
    }
    const packet = [{
      folder: {
        uploadInTargerFolder: true,
        name: '',
        fullPath: '/root',
        onlyPath: ''
      },
      files
    }];
    onNewUploadPacket(targetFolderId, dispatch, urlObj, handlers, chunkingConfig, packet);
  }
};

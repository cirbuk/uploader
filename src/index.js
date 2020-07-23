import { getUploadPacket } from './packet';
import FlowManager from './flowmanager';

const promiseSerial = funcs =>
  funcs.reduce((promise, func) => promise.then(result => func().then(Array.prototype.concat.bind(result))), Promise.resolve([]));

const onNewUploadPacket = (uploadPacket, targetFolderId, dispatch, urlObj) =>
  promiseSerial(
    uploadPacket.map(pack => () => {
      const { folder } = pack;
      return new Promise(resolve => {
        if (folder.uploadInTargerFolder) {
          //? If no folder needs to be created, skip createFolderFlow
          resolve({ id: targetFolderId });
          return FlowManager.uploadFilesFlow({ id: targetFolderId }, pack.files, dispatch, urlObj);
        }
        const folderIdForNewFolder = FlowManager.folderIdForPathCache[folder.onlyPath] ?
          FlowManager.folderIdForPathCache[folder.onlyPath] : targetFolderId;

        // UploadFlowManager.createFolderFlowForPacket(pack, folderIdForNewFolder, ({ type, payload }) => {
        //   if (type === types.FOLDER_CREATED) {
        //     resolve(payload.folderCreated);
        //   }
        //   dispatch({ type, payload });
        // });
      });
    }));

export const upload = ({ targetFolderId, callback: dispatch, urls: urlObj, dataTransfer, files } = {}) => {
  if (dataTransfer) {
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
      onNewUploadPacket(packet, targetFolderId, dispatch, urlObj);
    } else {
      getUploadPacket(dataTransfer.items, onNewUploadPacket.bind(null, targetFolderId, dispatch, urlObj));
    }
  } else if (files.length > 0) {
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
        uploadInTargerFolder: true,
        name: '',
        fullPath: '/root',
        onlyPath: ''
      },
      files: fileEntries
    }];
    onNewUploadPacket(packet, targetFolderId, dispatch, urlObj);
  }
};

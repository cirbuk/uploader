import { uuid, getExtension, isFileTypeSupported } from './util.js';
import Axios from 'axios';
import errorMessages from './messages';

export default class FlowManager {
  static createFolderFlowForPacket(pack, targetFolderId, eventHandler) {
    // const { folder } = pack;
    // return services.assets
    //   .newFolder()
    //   .notifyStore()
    //   .send({
    //     name: folder.name,
    //     path: targetFolderId,
    //     asset_type: 'folder',
    //     url: 'None'
    //   })
    //   .then(createdFolder => {
    //     UploadFlowManager.folderIdForPathCache[folder.fullPath] = createdFolder.id;
    //     eventHandler({
    //       type: types.FOLDER_CREATED,
    //       payload: { createdFolder: { ...createdFolder, created_time: new Date() }, parentFolderId: targetFolderId, appendAt: 'start' }
    //     });
    //     if (pack.files.length > 0) {
    //       return UploadFlowManager.uploadFilesFlow(createdFolder, pack.files, eventHandler);
    //     }
    //   })
    //   .catch(exception => {
    //     eventHandler({ type: types.FOLDER_CREATE_FAILED, payload: { exception, for: { targetFolderId, pack } } });
    //   });
  };

  static uploadFilesFlow(targetFolder, files, eventHandler, urlObj) {
    const whiteListedFileEntries = files.filter(file => !file.name.startsWith('.'));
    const tempIds = whiteListedFileEntries.map(() => uuid());

    whiteListedFileEntries.map((file, index) => {
      eventHandler({
        type: 'FILE_UPLOAD_INITIATED',
        payload: {
          name: file.name,
          meta: {
            folder: targetFolder.id
          },
          taskId: tempIds[index]
        }
      });
    });

    return Axios.request({
        url: urlObj.signingUrl,
        method: 'post',
        data: {
          path: targetFolder.id,
          files: whiteListedFileEntries.map(file => file.name),
          async: 0,
        }
      })
      .then(response => {
        response.data.map((uploadUrlData, index) => {
          const fileEntry = whiteListedFileEntries[index];
          fileEntry.file(file => {
            const tempTaskId = tempIds[index];
            eventHandler({ type: "FILE_UPLOAD_PROGRESS", payload: { progress: 1, taskId: tempTaskId } });
            window.parent.postMessage({ type: "PROGRESSED", message: 1 }, "*");
            const extension = getExtension(file);
            if (uploadUrlData && uploadUrlData.url) {
              return Axios.request({
                  method: 'post',
                  url: uploadUrlData.url,
                  data: file,
                  onUploadProgress: (progressData) => {
                    const { loaded, total } = progressData;
                    const percent = Math.round((loaded / total) * 100)
                    eventHandler({
                      type: "FILE_UPLOAD_PROGRESS",
                      payload: { progress: percent, taskId: tempTaskId }
                    });
                    if (percent === 100) {
                      window.parent.postMessage({
                        type: "COMPLETED", message: {
                          file: file.name,
                          fileUrl: URL.createObjectURL(file)
                        }
                      }, "*")
                    } else window.parent.postMessage({ type: "PROGRESSED", message: percent }, "*");
                  }
                })
                .then(e => {
                  Axios.request({
                      method: 'post',
                      url: urlObj.confirmUpload,
                      data: uploadUrlData
                    })
                    .then(data => {
                      eventHandler({ type: "FILE_CONFIRM_UPLOAD_SUCCESS", payload: { data, oldId: tempTaskId } });
                    })
                    .catch(exception => {
                      eventHandler({
                        type: "FILE_CONFIRM_UPLOAD_FAILED",
                        payload: { message: errorMessages.FILE_CONFIRM_UPLOAD_FAILED, exception, taskId: tempTaskId }
                      });
                    });
                })
                .catch(exception => {
                  eventHandler({
                    type: "FILE_UPLOAD_FAILED",
                    payload: { message: errorMessages.FILE_UPLOAD_FAILED, exception, taskId: tempTaskId }
                  });
                });
            } else if (!isFileTypeSupported(extension)) {
              eventHandler({
                type: "GET_FILE_UPLOAD_URL_FAILED",
                payload: { message: errorMessages.EXTENSION_NOT_SUPPORTED, taskId: tempTaskId }
              });
            } else {
              eventHandler({
                type: "GET_FILE_UPLOAD_URL_FAILED",
                payload: { message: errorMessages.GET_FILE_UPLOAD_URL_FAILED, taskId: tempTaskId }
              });
            }
          });
        });
      });
  };
}

FlowManager.folderIdForPathCache = [];

import { uuid, getExtension, isFileTypeSupported } from './util.js';
import Axios from 'axios';
import errorMessages from './messages';

export default class FlowManager {
  static createFolderFlowForPacket(pack, targetFolderId, folderCreationUrl, handlers, eventHandler) {
    const { folder } = pack;
    return Axios.request({
        url: folderCreationUrl,
        method: 'post',
        data: {
          name: folder.name,
          path: targetFolderId,
          asset_type: 'folder',
          url: 'None'
        }
      })
      .then(createdFolder => {
        UploadFlowManager.folderIdForPathCache[folder.fullPath] = createdFolder.id;
        eventHandler({
          type: 'FOLDER_CREATED',
          payload: {
            createdFolder: { ...createdFolder, created_time: new Date() },
            parentFolderId: targetFolderId,
            appendAt: 'start'
          }
        });
        if (pack.files.length > 0) {
          return FlowManager.uploadFilesFlow(createdFolder, pack.files, eventHandler, urlObj, handlers);
        }
      })
      .catch(exception => {
        eventHandler({ type: "FOLDER_CREATE_FAILED", payload: { exception, for: { targetFolderId, pack } } });
      });
  };

  static uploadFilesFlow(targetFolder, files, eventHandler, urlObj, handlers, chunkingConfig) {
    const whiteListedFileEntries = files.filter(file => !file.name.startsWith('.'));
    const tempIds = whiteListedFileEntries.map(() => uuid());
    let chunkTempIds = [];
    let chunksToBeUploaded = [];
    let chunkCount = 0;
    const { minSize, maxSize, enableChunking } = chunkingConfig;

    if (enableChunking && files.length === 1 && files[0].size >= minSize && files[0].size <= maxSize) {
      const file = files[0];
      const chunkSize = 256 * 1024;
      const chunkArr = getChunkSizeArray(file.size, chunkSize);
      let start = 0;
      chunksToBeUploaded = chunkArr.map((val, index) => {
        const end = (start + val) > file.size ?
          file.size : start + val;
        const chunk = file.slice(start, end)
        const fileEntry = new File([chunk], index + file.name, { type: 'text/plain' });
        fileEntry.file = callback => {
          callback(fileEntry);
        };
        initiateChunkUpload(chunkTempIds, tempIds, file.name, targetFolder.id, index, eventHandler)
        start = end;
        return fileEntry;
      })

      chunkCount = chunksToBeUploaded.length;
    } else {
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
    }
    const detailsObj = {}
    if (targetFolder.id.test('/')) {
      detailsObj['path'] = folder.id;
    } else detailsObj['folder_id'] = folder.id;

    if (chunkCount > 1) {
      detailsObj['parallel_chunks'] = chunkCount;
    }

    return Axios.request({
        url: urlObj.signingUrl,
        method: 'post',
        data: {
          details: whiteListedFileEntries.map(file => {
            return {
              filename: file.name,
              ...detailsObj
            }
          })
        }
      })
      .then(response => {
        if (chunkCount > 1) {
          const { urls, ...uploadUrlData } = response.data[0];
          Object.keys(urls).map((key, index) => {
            const url = urls[key];
            const file = chunksToBeUploaded[index];
            const tempTaskId = chunkTempIds[index];
            eventHandler({
              type: "CHUNK_UPLOAD_PROGRESS",
              payload: { progress: 1, chunkTaskId: tempTaskId, taskId: tempIds[0] }
            });
            const extension = getExtension(file);

            if (url) {
              return Axios.request({
                  method: 'post',
                  url,
                  data: file,
                  onUploadProgress: (progressData) => {
                    const { loaded, total } = progressData;
                    const percent = Math.round((loaded / total) * 100)
                    eventHandler({
                      type: "CHUNK_UPLOAD_PROGRESS",
                      payload: { progress: percent, taskId: tempIds[0], chunkTaskId: tempTaskId }
                    });
                    handlers.onProgress(progressData, uploadUrlData);
                    if (percent === 100) {
                      handlers.onCompleted(uploadUrlData);
                    }
                  }
                })
                .then(e => {
                })
                .catch(exception => {
                  eventHandler({
                    type: "CHUNK_UPLOAD_FAILED",
                    payload: {
                      message: errorMessages.FILE_UPLOAD_FAILED,
                      exception,
                      taskId: tempIds[0],
                      chunkTaskId: tempTaskId
                    }
                  });
                });
            } else if (!isFileTypeSupported(extension)) {
              eventHandler({
                type: "GET_FILE_UPLOAD_URL_FAILED",
                payload: { message: errorMessages.EXTENSION_NOT_SUPPORTED, taskId: tempIds[0] }
              });
            } else {
              eventHandler({
                type: "GET_FILE_UPLOAD_URL_FAILED",
                payload: { message: errorMessages.GET_FILE_UPLOAD_URL_FAILED, taskId: tempIds[0] }
              });
            }
          });
        } else {
          response.data.map((uploadUrlData, index) => {
            const fileEntry = whiteListedFileEntries[index];
            fileEntry.file(file => {
              const tempTaskId = tempIds[index];
              eventHandler({ type: "FILE_UPLOAD_PROGRESS", payload: { progress: 1, taskId: tempTaskId } });
              const extension = getExtension(file);
              if (uploadUrlData && uploadUrlData.url) {
                const extn = file.name.split(".").pop();
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
                      handlers.onProgress(progressData, uploadUrlData);
                      if (percent === 100) {
                        handlers.onCompleted(uploadUrlData);
                      }
                    }
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
        }
      });
  };
}

FlowManager.folderIdForPathCache = [];

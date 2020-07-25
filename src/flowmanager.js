import {
  uuid,
  getExtension,
  isFileTypeSupported,
  EventEmitter,
  getChunkSizeArray,
  initiateChunkUpload
} from './util.js';
import Axios from 'axios';
import { messages, events } from './constants';
import { isValidString } from "@kubric/litedash";

export default class FlowManager extends EventEmitter {
  static init({ chunking, urls }) {
    FlowManager.chunkingConfig = chunking;
    FlowManager.apiUrls = urls;
  };

  constructor(targetFolderId) {
    super();
    this.targetFolderId = targetFolderId;
  }

  createFolderFlowForPacket(pack, targetFolderId, callback) {
    const folderCreationUrl = FlowManager.apiUrls.createFolder;
    if (!isValidString(folderCreationUrl)) {
      throw new Error("No API provided for folder creation");
    }
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
        const eventData = {
          createdFolder: { ...createdFolder, created_time: new Date() },
          parentFolderId: targetFolderId,
          appendAt: 'start'
        };
        callback(null, eventData);
        FlowManager.folderIdForPathCache[folder.fullPath] = createdFolder.id;
        this.emit(events.FOLDER_CREATED, eventData);
        if (pack.files.length > 0) {
          return this.uploadFilesFlow(createdFolder, pack.files);
        }
      })
      .catch(error => {
        const eventData = {
          error,
          for: {
            targetFolderId,
            pack
          }
        }
        callback(eventData);
        this.emit(events.FOLDER_CREATE_FAILED, eventData);
      });
  };

  uploadFilesFlow(targetFolder, files) {
    const whiteListedFileEntries = files.filter(file => !file.name.startsWith('.'));
    const tempIds = whiteListedFileEntries.map(() => uuid());
    let chunkTempIds = [];
    let chunksToBeUploaded = [];
    let chunkCount = 0;
    const { min:minSize, max:maxSize, enableChunking } = FlowManager.chunkingConfig;

    if (enableChunking && files.length === 1 && files[0].size >= minSize && files[0].size <= maxSize) {
      const file = files[0];
      const chunkSize = 256 * 1024;
      const chunkArr = getChunkSizeArray(file.size, chunkSize);
      let start = 0;
      chunksToBeUploaded = chunkArr.map((val, index) => {
        const end = ((start + val) > file.size) ? file.size : (start + val);
        const chunk = file.slice(start, end)
        const fileEntry = new File([chunk], index + file.name, { type: 'text/plain' });
        fileEntry.file = callback => {
          callback(fileEntry);
        };
        initiateChunkUpload.call(this, chunkTempIds, tempIds, file.name, targetFolder.id, index);
        start = end;
        return fileEntry;
      })

      chunkCount = chunksToBeUploaded.length;
    } else {
      whiteListedFileEntries.map((file, index) => {
        this.emit(events.FILE_UPLOAD_INITIATED, {
          name: file.name,
          meta: {
            folder: targetFolder.id
          },
          taskId: tempIds[index]
        });
      });
    }
    const detailsObj = {}
    detailsObj[/\//.test(targetFolder.id) ? 'path' : "folder_id"] = targetFolder.id;
    if (chunkCount > 1) {
      detailsObj['parallel_chunks'] = chunkCount;
    }
    const { getUploadUrl } = FlowManager.apiUrls;
    return Axios.request({
        url: getUploadUrl,
        method: 'post',
        data: whiteListedFileEntries.map(file => {
            return {
              filename: file.name,
              ...detailsObj
            }
          })
      })
      .then(response => {
        if (chunkCount > 1) {
          const { urls, ...uploadUrlData } = response.data[0];
          Object.keys(urls)
            .map((key, index) => {
              const url = urls[key];
              const file = chunksToBeUploaded[index];
              const tempTaskId = chunkTempIds[index];
              this.emit(events.CHUNK_UPLOAD_PROGRESS, {
                progress: 1,
                chunkTaskId: tempTaskId,
                taskId: tempIds[0]
              })
              const extension = getExtension(file);
              if (url && isFileTypeSupported(extension)) {
                return Axios.request({
                    method: 'post',
                    url,
                    data: file,
                    onUploadProgress: (progressData) => {
                      const { loaded, total } = progressData;
                      const percent = Math.round((loaded / total) * 100);
                      this.emit(events.CHUNK_UPLOAD_PROGRESS, {
                        progress: percent,
                        taskId: tempIds[0],
                        chunkTaskId: tempTaskId
                      });
                    }
                  })
                  .then(e => {
                    this.emit(events.CHUNK_UPLOAD_COMPLETED, {
                      taskId: tempIds[0],
                      chunkTaskId: tempTaskId
                    });
                  })
                  .catch(exception => {
                    this.emit(events.CHUNK_UPLOAD_FAILED, {
                      message: messages.FILE_UPLOAD_FAILED,
                      exception,
                      taskId: tempIds[0],
                      chunkTaskId: tempTaskId
                    });
                  });
              } else {
                this.emit(events.GET_FILE_UPLOAD_URL_FAILED, {
                  message: messages.GET_FILE_UPLOAD_URL_FAILED,
                  taskId: tempIds[0]
                });
              }
            });
        } else {
          response.data.map((uploadUrlData, index) => {
            const fileEntry = whiteListedFileEntries[index];
            fileEntry.file(file => {
              const tempTaskId = tempIds[index];
              this.emit(events.FILE_UPLOAD_PROGRESS, {
                progress: 1,
                taskId: tempTaskId
              });
              const extension = getExtension(file);
              if (uploadUrlData && uploadUrlData.url && isFileTypeSupported(extension)) {
                const extn = file.name.split(".").pop();
                return Axios.request({
                    method: 'post',
                    url: uploadUrlData.url,
                    data: file,
                    onUploadProgress: (progressData) => {
                      const { loaded, total } = progressData;
                      const percent = Math.round((loaded / total) * 100)
                      this.emit(events.FILE_UPLOAD_PROGRESS, {
                        progress: percent,
                        taskId: tempTaskId,
                        uploadUrlData
                      });
                    }
                  })
                  .then(() => {
                    this.emit(events.FILE_UPLOAD_COMPLETED, uploadUrlData);
                  })
                  .catch(error => {
                    this.emit(events.FILE_UPLOAD_FAILED, {
                      error,
                      taskId: tempTaskId
                    });
                  });
              } else {
                this.emit(events.GET_FILE_UPLOAD_URL_FAILED, {
                  taskId: tempTaskId
                });
              }
            });
          });
        }
      });
  };
}

FlowManager.chunkingConfig = {};
FlowManager.apiUrls = {};
FlowManager.folderIdForPathCache = [];

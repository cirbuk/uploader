import {
  uuid,
  getExtension,
  isFileTypeSupported,
  EventEmitter,
  getChunkSizeArray,
  initiateChunkUpload,
  getDataObject,
  getFileMeta
} from './util.js';
import Axios from 'axios';
import {messages, events, internalEvents} from './constants';
import {isFunction, isValidString} from "@kubric/utils";

export default class FlowManager extends EventEmitter {
  static init({chunking = {}, urls = {}}) {
    FlowManager.chunkingConfig = chunking;
    FlowManager.apiUrls = urls;
  };

  constructor(token, isPublic, getQueuedTasksProgress, getChunkTasksProgress) {
    super();
    this.getQueuedTasksProgress = getQueuedTasksProgress;
    this.getChunkTasksProgress = getChunkTasksProgress;
    this.token = token;
    this.isPublic = isPublic;
  }

  createFolderFlowForPacket(pack, targetFolderId, callback, payload) {
    const {createFolder} = FlowManager.apiUrls
    const folderCreationUrlPromise = isFunction(createFolder) ? createFolder() : Promise.resolve(createFolder);
    const {folder} = pack;
    return folderCreationUrlPromise
      .then((apiUrl) => Axios.request({
        url: apiUrl,
        method: 'post',
        data: {
          data: {
            name: folder.name,
            path: targetFolderId,
            asset_type: 'folder',
            url: 'None',
          },
          token: this.token
        }
      }))
      .then(createdFolder => {
        const eventData = {
          createdFolder: {...createdFolder.data, created_time: new Date()},
          parentFolderId: targetFolderId,
          appendAt: 'start',
          ...(payload && {payload}),
        };
        callback(null, eventData);
        FlowManager.folderIdForPathCache[folder.fullPath] = createdFolder.data.id;
        this.emit(events.FOLDER_CREATED, eventData);
        if (pack.files.length > 0) {
          return this.uploadFilesFlow(createdFolder.data, pack.files, undefined, payload);
        }
      })
      .catch(error => {
        const eventData = {
          error,
          for: {
            targetFolderId,
            pack
          },
          ...(payload && {payload}),
        }
        callback(eventData);
        this.emit(events.FOLDER_CREATE_FAILED, eventData);
      });
  };

  uploadFilesFlow(targetFolder, files, tags, payload) {
    const whiteListedFileEntries = files.filter(file => !file.name.startsWith('.'));
    const tempIds = whiteListedFileEntries.map(() => uuid());
    let chunkTempIds = [];
    let chunksToBeUploaded = [];
    let chunkCount = 0;
    const {min: minSize, max: maxSize, enable: enableChunking} = FlowManager.chunkingConfig;
    if (enableChunking && files.length === 1 && files[0].size >= minSize && files[0].size <= maxSize) {
      const file = files[0];
      const chunkSize = 256 * 1024;
      const chunkArr = getChunkSizeArray(file.size, chunkSize);
      let start = 0;
      chunksToBeUploaded = chunkArr.map((val, index) => {
        const end = ((start + val) > file.size) ? file.size : (start + val);
        const chunk = file.slice(start, end)
        const fileEntry = new File([chunk], index + file.name, {type: 'text/plain'});
        fileEntry.file = callback => {
          callback(fileEntry);
        };
        initiateChunkUpload.call(this, chunkTempIds, tempIds, file.name, targetFolder.id, index, file);
        start = end;
        return fileEntry;
      });

      this.emit(events.FILE_UPLOAD_INITIATED,
        getDataObject(false, file, tempIds[0], targetFolder.id, payload));
      this.emitUploader(internalEvents.UPLOAD_INITIATED,
        getDataObject(true, file, tempIds[0]));
      chunkCount = chunksToBeUploaded.length;
    } else {
      whiteListedFileEntries.map((file, index) => {
        if (file.size) {
          this.emit(events.FILE_UPLOAD_INITIATED,
            getDataObject(false, file, tempIds[index], targetFolder.id, payload));
          this.emitUploader(internalEvents.UPLOAD_INITIATED,
            getDataObject(true, file, tempIds[index]));
        } else {
          file._data ? fl._data = file._data : '';
          file.file((fl) => {
            this.emit(events.FILE_UPLOAD_INITIATED,
              getDataObject(false, fl, tempIds[index], targetFolder.id, payload));
            this.emitUploader(internalEvents.UPLOAD_INITIATED,
              getDataObject(true, fl, tempIds[index]));
          });
        }
      });
    }
    const detailsObj = {};
    const dataObj = {};
    if (!this.token) {
      detailsObj[/\//.test(targetFolder.id) ? 'path' : "folder_id"] = targetFolder.id;
    }

    if (chunkCount > 1) {
      dataObj['parallel_chunks'] = chunkCount;
    }
    const {getUploadUrl} = FlowManager.apiUrls;
    let getUploadUrlPromise = isFunction(getUploadUrl) ? getUploadUrl() : Promise.resolve(getUploadUrl)
    return getUploadUrlPromise
      .then((apiUrl) =>
        Axios.request({
          url: apiUrl,
          method: 'post',
          data: {
            ...dataObj,
            token: this.token,
            details: whiteListedFileEntries.map(file => {
              return {
                public: this.isPublic,
                filename: file.name,
                tags,
                ...detailsObj
              }
            })
          }
        })
      )
      .then(response => {
        if (chunkCount > 1) {
          const {urls, ...uploadUrlData} = response.data[0];
          Object.keys(urls)
            .map((key, index) => {
              const url = urls[key];
              const file = chunksToBeUploaded[index];
              const tempTaskId = chunkTempIds[index];
              this.emitChunk(internalEvents.CHUNK_UPLOAD_PROGRESS, {
                progress: 1,
                chunkTaskId: tempTaskId,
                taskId: tempIds[0]
              });
              this.emitUploader(internalEvents.UPLOAD_PROGRESS, {
                progress: this.getChunkTasksProgress(tempIds[0]),
                taskId: tempIds[0],
                uploadData: uploadUrlData
              });
              this.emit(events.FILE_UPLOAD_PROGRESS, {
                progress: this.getChunkTasksProgress(tempIds[0]),
                taskId: tempIds[0],
                data: file._data,
                ...uploadUrlData,
                ...getFileMeta(file, payload)
              });
              const extension = getExtension(file);
              if (url && isFileTypeSupported(extension)) {
                const fileData = file._data;
                return Axios.request({
                  method: 'post',
                  url,
                  data: file,
                  onUploadProgress: (progressData) => {
                    const {loaded, total} = progressData;
                    const percent = Math.round((loaded / total) * 100);
                    this.emitChunk(internalEvents.CHUNK_UPLOAD_PROGRESS, {
                      progress: percent,
                      chunkTaskId: tempTaskId,
                      taskId: tempIds[0]
                    });
                    this.emitUploader(internalEvents.UPLOAD_PROGRESS, {
                      progress: this.getChunkTasksProgress(tempIds[0]),
                      taskId: tempIds[0]
                    });
                    this.emit(events.FILE_UPLOAD_PROGRESS, {
                      progress: this.getChunkTasksProgress(tempIds[0]),
                      taskId: tempIds[0],
                      data: fileData,
                      ...uploadUrlData,
                      ...getFileMeta(file, payload)
                    });
                    this.emit(events.TOTAL_PROGRESS, {
                      progress: this.getQueuedTasksProgress(),
                      ...(payload && {payload})
                    });
                  }
                })
                  .then(e => {
                    this.emitChunk(internalEvents.CHUNK_UPLOAD_COMPLETED, {
                      taskId: tempIds[0],
                      chunkTaskId: tempTaskId
                    });

                    if (this.getChunkTasksProgress(tempIds[0]) === 100) {
                      this.emitUploader(internalEvents.UPLOAD_COMPLETED, {
                        isComplete: true,
                        taskId: tempTaskId
                      });
                      this.emit(events.FILE_UPLOAD_COMPLETED, {
                        data: fileData,
                        ...uploadUrlData,
                        ...getFileMeta(file, payload)
                      });
                    }
                  })
                  .catch(error => {
                    this.emitUploader(internalEvents.UPLOAD_FAILED, {
                      isError: true,
                      taskId: tempIds[0]
                    });
                    this.emit(events.FILE_UPLOAD_FAILED, {
                      message: messages.FILE_UPLOAD_FAILED,
                      error,
                      taskId: tempIds[0],
                      data: fileData,
                      ...uploadUrlData,
                      ...getFileMeta(file, payload)
                    });
                  });
              } else {
                this.emitUploader(internalEvents.UPLOAD_FAILED, {
                  isError: true,
                  taskId: tempIds[0]
                });
                this.emit(events.GET_FILE_UPLOAD_URL_FAILED, {
                  taskId: tempIds[0],
                  ...getFileMeta(file, payload)
                });
              }
            });
        } else {
          response.data.map((uploadUrlData, index) => {
            const fileEntry = whiteListedFileEntries[index];
            fileEntry.file(file => {
              const tempTaskId = tempIds[index];
              this.emitUploader(internalEvents.UPLOAD_PROGRESS, {
                progress: 1,
                taskId: tempTaskId,
                uploadData: uploadUrlData
              });
              this.emit(events.FILE_UPLOAD_PROGRESS, {
                data: file._data,
                progress: 1,
                taskId: tempTaskId,
                ...uploadUrlData,
                ...getFileMeta(file, payload)
              });
              const extension = getExtension(file);
              if (uploadUrlData && uploadUrlData.url && isFileTypeSupported(extension)) {
                const fileData = file._data;
                return Axios.request({
                  method: 'post',
                  url: uploadUrlData.url,
                  data: file,
                  onUploadProgress: (progressData) => {
                    const {loaded, total} = progressData;
                    const percent = Math.round((loaded / total) * 100)
                    this.emitUploader(internalEvents.UPLOAD_PROGRESS, {
                      progress: percent,
                      taskId: tempTaskId
                    });
                    percent > 0 && this.emit(events.FILE_UPLOAD_PROGRESS, {
                      data: fileData,
                      progress: percent,
                      taskId: tempTaskId,
                      ...uploadUrlData,
                      ...getFileMeta(file, payload)
                    });
                    this.emit(events.TOTAL_PROGRESS, {
                      progress: this.getQueuedTasksProgress(),
                      ...(payload && {payload})
                    });
                  }
                })
                  .then(() => {
                    this.emitUploader(internalEvents.UPLOAD_COMPLETED, {
                      isComplete: true,
                      taskId: tempTaskId
                    });
                    this.emit(events.FILE_UPLOAD_COMPLETED, {
                      data: fileData,
                      taskId: tempTaskId,
                      ...uploadUrlData,
                      ...getFileMeta(file, payload)
                    });
                  })
                  .catch(error => {
                    this.emitUploader(internalEvents.UPLOAD_FAILED, {
                      isError: true,
                      taskId: tempTaskId
                    });
                    this.emit(events.FILE_UPLOAD_FAILED, {
                      data: fileData,
                      error,
                      taskId: tempTaskId,
                      ...uploadUrlData,
                      ...getFileMeta(file, payload)
                    });
                  });
              } else {
                this.emitUploader(internalEvents.UPLOAD_FAILED, {
                  isError: true,
                  taskId: tempTaskId
                });
                this.emit(events.GET_FILE_UPLOAD_URL_FAILED, {
                  taskId: tempTaskId,
                  ...getFileMeta(file, payload)
                });
              }
            });
          });
        }
      })
      .catch(error => {
        this.emitUploader(internalEvents.UPLOAD_FAILED, {
          isError: true
        });
        this.emit(events.FILE_UPLOAD_FAILED, {
          error,
          files,
          ...(payload && {payload})
        });
      });
  };
}

FlowManager.chunkingConfig = {};
FlowManager.apiUrls = {};
FlowManager.folderIdForPathCache = [];

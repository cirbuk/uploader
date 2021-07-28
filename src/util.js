// Utility to convert FileList into FileEntries
export const getFileEntries = (files = []) => {
  const fileEntries = [];

  for (let i = 0; i < files.length; i+=1) {
    const fileEntry = files[i];
    fileEntry.file = callback => {
      callback(fileEntry);
    };
    fileEntries.push(fileEntry);
  }

  return fileEntries;
}

export const uuid = () =>
  'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    let r = (Math.random() * 16) | 0, v = c == 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });

export const getExtension = (file) =>
  (file && file.name && typeof file.name === 'string') ? file.name.split('.').pop() : 'unknown';

export const isFileTypeSupported = (extension) => [
  '.png',
  '.jpeg',
  '.jpe',
  '.jpg',
  '.eps',
  '.mkv',
  '.mov',
  '.ttf',
  '.otf',
  '.mp3',
  '.m4a',
  '.mp4',
  '.webm',
  '.srt',
  '.wav',
  '.tif',
  '.tiff',
  '.gif',
  '.psd',
  '.cr2',
  '.zip',
  '.aep',
  '.aet',
  '.ai',
  '.svg',
  '.pdf',
  '.sketch',
  '.csv',
  '.txt',
].includes('.' + extension.toLowerCase());

export const getChunkSizeArray = (fileSize, chunkSize) => {
  const chunkNumber = 6;
  const val = fileSize / chunkSize;
  const arr = new Array(chunkNumber).fill(0, 0, chunkNumber);
  const chunkMultiple = Math.floor(val / chunkNumber);
  const chunkRemainder = val % chunkNumber;

  return arr.map((val, index) => {
    let value = val;
    value = value + (chunkMultiple * chunkSize);

    if (index < chunkRemainder) {
      value = value + (chunkSize);
    }

    return value;
  }).filter(x => x);
}

export const getChunks = (file, chunkFactor, chunksize) => {
  const chunksArray = [];
  const chunkSize = chunksize ? chunksize : Math.ceil(file.size / chunkFactor);
  let chunkCount = 1;
  for (let start = 0; start < file.size; start = start + chunkSize) {
    const end = (start + chunkSize) > file.size ?
      file.size : start + chunkSize;
    const chunk = file.slice(start, end)
    const fileEntry = new File([chunk], chunkCount + file.name, { type: 'text/plain' });
    fileEntry.file = callback => {
      callback(fileEntry);
    };
    chunksArray.push(fileEntry);
    chunkCount++;
  }
  return chunksArray;
}

export const promiseSerial = funcs => funcs.reduce((promise, func) => promise.then(result => func().then(Array.prototype.concat.bind(result))), Promise.resolve([]));

export class EventEmitter {
  constructor() {
    this.handlers = {};
  }

  on(event, handler) {
    const registered = this.handlers[event] || [];
    const alreadyRegistered = registered.length > 0 && registered.some(h => h === handler);
    !alreadyRegistered && registered.push(handler);
    this.handlers[event] = registered;
    return () => {
      this.handlers[event] = registered.filter(h => h !== handler);
    };
  }

  _emit(event, data) {
    const registered = this.handlers[event] || [];
    registered.forEach(handler => handler(data));
  }

  emitUploader(event, data) {
    this._emit("ALL_UPLOADER", {
      event,
      data
    });
  }

  emitChunk(event, data) {
    this._emit("CHUNK_TASK", {
      event,
      data
    });
  }

  emit(event, data) {
    this._emit(event, data);
    this._emit("ALL", {
      event,
      data
    });
  }
}

export function initiateChunkUpload(chunkTempIds, tempIds, name, id, chunkCount, file) {
  chunkTempIds.push(uuid());
  this.emitChunk(
    "CHUNK_UPLOAD_INITIATED", {
      filename: name,
      path: id,
      taskId: tempIds[0],
      data: file._data,
      chunkTaskId: chunkTempIds[chunkCount]
    });
  return chunkTempIds;
}

export function getDataObject(isInternal, file, taskId, path, payload) {
  if (isInternal) {
    return {
      filename: file.name,
      sizeInBytes: file.size,
      lastModified: file.lastModified,
      size: getHumanFileSize(file.size),
      progress: 0,
      isComplete: false,
      isError: false,
      taskId,
      ...(payload && {payload}),
    }
  } else {
    return {
      filename: file.name,
      sizeInBytes: file.size,
      lastModified: file.lastModified,
      size: getHumanFileSize(file.size),
      path,
      taskId,
      data: file._data,
      ...(payload && {payload}),
    }
  }
}

export const getHumanFileSize = (fileSizeInBytes) => {
  if (fileSizeInBytes) {
    let size = fileSizeInBytes;
    let finalSize = size + ' Bytes';
    if (size > 1024) {
      size = Math.round(size / 1024, 2);
      finalSize = size + ' KB';
    }
    if (size > 1024) {
      size = Math.round(size / 1024, 2);
      finalSize = size + ' MB';
    }
    if (size > 1024) {
      size = Math.round(size / 1024, 2);
      finalSize = size + ' GB';
    }
    return `${finalSize}`;
  } else {
    return `-`;
  }
};

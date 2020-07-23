function getAllFileEntries(dataTransferItemList) {
  let fileEntries = [];
  let directoryEntries = [];

  // Use BFS to traverse entire directory/file structure
  let queue = [];
  // Unfortunately dataTransferItemList is not iterable i.e. no forEach
  for (let i = 0; i < dataTransferItemList.length; i++) {
    queue.push(dataTransferItemList[i].webkitGetAsEntry());
  }

  let promises = []
  while (queue.length > 0) {
    let entry = queue.shift();
    if (entry.isFile) {
      fileEntries.push(entry);
    } else if (entry.isDirectory) {
      directoryEntries.push(entry);
      promises.push(readAllDirectoryEntries(entry.createReader())
        .then((dirEntries = []) => queue.push(...dirEntries)));
    }
  }

  return Promise.all(promises)
    .then(() => {
      let uploadPacket = [];

      directoryEntries.map(directory => {
        const associatedFiles = fileEntries
          .filter(fileEntry => fileEntry.fullPath === directory.fullPath + '/' + fileEntry.name)
          .filter(fileEntry => !fileEntry.name.startsWith('.'));
        let temp = directory.fullPath.split('/').filter(a => a.length > 0);
        temp.pop();
        uploadPacket.push({
          folder: {
            name: directory.name,
            fullPath: directory.fullPath,
            onlyPath: '/' + temp.join('/')
          },
          files: associatedFiles
        });
      });

      const rootFiles = fileEntries.filter(fileEntry => fileEntry.fullPath === '/' + fileEntry.name);

      if (rootFiles.length > 0) {
        uploadPacket.push({
          folder: {
            uploadInTargerFolder: true,
            name: '',
            fullPath: '/root',
            onlyPath: ''
          },
          files: rootFiles
        });
      }

      return uploadPacket;
    });
}

function readAllDirectoryEntries(directoryReader) {
  let entries = [];
  const paginator = () =>
    readEntriesPromise(directoryReader)
      .then(readEntries => {
        if (readEntries.length > 0) {
          entries.push(...readEntries);
          return paginator();
        } else {
          return entries;
        }
      });
  return paginator();
}

function readEntriesPromise(directoryReader) {
  try {
    return new Promise((resolve, reject) => {
      directoryReader.readEntries(resolve, reject);
    });
  } catch (err) {
    console.log(err);
  }
}

export const getUploadPacket = (items, callback) =>
  getAllFileEntries(items)
    .then(callback);
  
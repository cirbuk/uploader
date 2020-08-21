import { internalEvents } from './constants';

const getTasks = (tasks, data) => {
  const taskObj = { curTasks: [], othTasks: [] };
  tasks.reduce((acc, task) => {
    if (task.taskId === data.taskId) {
      acc.curTasks.push(task);
    } else acc.othTasks.push(task);
    return acc;
  }, taskObj);

  return taskObj;
}

export const uploadTaskReducer = (tasks = [], action) => {
  const { event, data = {} } = action;
  switch (event) {
    case internalEvents.UPLOAD_INITIATED:
      return [...tasks, data];
    case internalEvents.UPLOAD_COMPLETED:
    case internalEvents.UPLOAD_FAILED:
    case internalEvents.UPLOAD_PROGRESS:
      if (tasks.filter(task => task.taskId === data.taskId).length > 0) {
        return tasks.map(task => (data.taskId === task.taskId ? {
          ...task,
          ...data
        } : task));
      } else {
        return tasks;
      }
      ;
    default:
      return tasks;

  }

}

export const chunkTaskReducer = (tasks = [], action) => {
  const { event, data = {} } = action;
  switch (event) {
    case internalEvents.CHUNK_UPLOAD_INITIATED:
      const { curTasks, othTasks } = getTasks(tasks, data);
      if (curTasks.length === 0) {
        return [
          ...othTasks,
          {
            ...data,
            title: data.name,
            status: 0,
            progress: 0,
            chunkTasks: [{
              ...data,
              title: data.name, status: 0, progress: 0
            }]
          }
        ];
      } else {
        const isChunkTask = curTasks[0].chunkTasks.some(chunkTask => chunkTask.chunkTaskId === data.chunkTaskId);
        if (isChunkTask) {
          return tasks;
        }
        const chunkTasks = [
          ...curTasks[0].chunkTasks,
          {
            ...data,
            title: data.name,
            status: 0,
            progress: 0
          }
        ];
        return [
          ...othTasks,
          {
            ...curTasks[0],
            chunkTasks
          }
        ];
      }
    case internalEvents.CHUNK_UPLOAD_PROGRESS:
      const { curTasks: currTasks, othTasks: otherTasks } = getTasks(tasks, data);
      let progressOld = 0;

      if (currTasks[0]) {
        const chunkTaskList = currTasks[0].chunkTasks.map((chunkTask) => {
          if (data.chunkTaskId === chunkTask.chunkTaskId) {
            progressOld = progressOld + data.progress;
            return {
              ...chunkTask,
              ...data
            };
          }

          progressOld = progressOld + chunkTask.progress;
          return chunkTask;
        });
        return [
          ...otherTasks,
          {
            ...currTasks[0],
            progress: progressOld / chunkTaskList.length,
            chunkTasks: chunkTaskList
          }
        ];
      } else return [...tasks];
    default:
      return tasks;

  }

}
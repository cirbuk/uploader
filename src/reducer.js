import { internalEvents } from './constants';

export default (tasks = [], action) => {
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
  }
}
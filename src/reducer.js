import { UploaderEvents } from './constants';

export default (tasks = [], action) => {
    const { event, data = {} } = action;
    switch (event) {
        case UploaderEvents.UPLOAD_INITIATED:
            return [...tasks, data];
        case UploaderEvents.UPLOAD_COMPLETED:
        case UploaderEvents.UPLOAD_FAILED:
        case UploaderEvents.UPLOAD_PROGRESS:
            if (tasks.filter(task => task.taskId === data.taskId).length > 0) {
                return tasks.map(task => (data.taskId === task.taskId ? {
                    ...task,
                    ...data
                  } : task));
            } else {
                return tasks;
            };
    }

}
const Notification = require("../model/notification.Schema"); 


exports.sendNotification = async (data, io) => {
   // ✅ Emit the event after updating
   io.emit("notificationCreated", {
    message: "A New Notification Added",
  });
  try {
    const notificationCreated = await Notification.create(data);
    return notificationCreated;
  } catch (error) {
    console.error('Error creating notification:', error);
    throw error;
  }
};
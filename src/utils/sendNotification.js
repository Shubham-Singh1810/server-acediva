const Notification = require("../model/notification.Schema"); 
const admin = require('firebase-admin');

exports.sendNotification = async (data, io) => {
   // ✅ Emit the event after updating
   io.emit("notificationCreated", {
    message: "A New Notification Added",
  });
  try {
    const notificationCreated = await Notification.create(data);
    const message = {
      notification: {
        title: data?.title || 'Default Title',
        body: data?.body || 'Default Body',
        image: data?.icon || 'Default Body',
      },
      token: registrationToken,
    };

    // Send the FCM message
    const response = await admin.messaging().send(message);
    return notificationCreated;
  } catch (error) {
    console.error('Error creating notification:', error);
    throw error;
  }
};
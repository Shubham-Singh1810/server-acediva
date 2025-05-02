const Notification = require("../model/notification.Schema");
const admin = require("firebase-admin");
var serviceAccount = require("./serviceAccountKey.json");

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}
exports.sendNotification = async (data) => {
  try {
    const notificationCreated = await Notification.create(data);
    const message = {
      notification: {
        title: data?.title || "Default Title",
        body: data?.subTitle || "Default Body",
        image: data?.icon || "Default Body",
      },
      token:
        "fCBfyfuaAl0FeG6e93S5mc:APA91bEWMG6tNIshaebx07iOP3lD537F-QOdgn_Wcl7unSBhjeuUzLNnUZccLDdbjb9ff-hg47alk9rJT-9bNYK_AwGaaGknvXgAgyMfkuo090qOjfEfTys",
    };
    const response = await admin.messaging().send(message);
    return notificationCreated;
  } catch (error) {
    console.error("Error creating notification:", error);
    throw error;
  }
};

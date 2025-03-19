const express = require("express");
const { sendResponse } = require("../utils/common");
require("dotenv").config();
const Booking = require("../model/booking.Schema");
const bookingController = express.Router();
require("dotenv").config();
const Repair = require("../model/repair.Schema");
const Installation = require("../model/installation.Schema");
const Service = require("../model/service.Schema");
const User = require("../model/user.Schema");

bookingController.post("/create", async (req, res) => {
  try {
    const bookingCreated = await Booking.create(req.body);
    sendResponse(res, 200, "Success", {
      message: "Booking created successfully!",
      data: bookingCreated,
      statusCode: 200,
    });
  } catch (error) {
    console.error(error);
    sendResponse(res, 500, "Failed", {
      message: error.message || "Internal server error",
      statusCode: 500,
    });
  }
});
bookingController.post("/list", async (req, res) => {
  try {
    const filter = { ...req.body };

// Remove empty values from filter
if (!filter.bookingStatus) delete filter.bookingStatus;
if (!filter.createdAt || filter.createdAt === "") {
    delete filter.createdAt;
} else {
    // Assuming you want to filter by a specific date range (e.g., today)
    const startOfDay = new Date(filter.createdAt);
    startOfDay.setHours(0, 0, 0, 0);

    const endOfDay = new Date(filter.createdAt);
    endOfDay.setHours(23, 59, 59, 999);

    filter.createdAt = { $gte: startOfDay, $lte: endOfDay };
}
    const bookingList = await Booking.find(filter).populate({
      path: "userId",
    }).populate({
      path: "venderId",
    }).sort({createdAt:-1});

    // Use Promise.all to handle async operations inside map()
    const updatedList = await Promise.all(
      bookingList.map(async (v) => {
        if (v?.serviceType == "service") {
          const serviceData = await Service.findOne({ _id: v.serviceId });
          return { ...v.toObject(), serviceData };
        }
        if (v?.serviceType == "repair") {
          const serviceData = await Repair.findOne({ _id: v.serviceId });
          return { ...v.toObject(), serviceData };
        }
        if (v?.serviceType == "installation") {
          const serviceData = await Installation.findOne({ _id: v.serviceId });
          return { ...v.toObject(), serviceData };
        }
        return v.toObject(); // Convert Mongoose document to plain object
      })
    );

    // Aggregate booking counts in a single query
    const bookingCounts = await Booking.aggregate([
      {
        $group: {
          _id: "$bookingStatus",
          count: { $sum: 1 },
        },
      },
    ]);

    // Convert array result to an object
    const counts = { totalCount: await Booking.countDocuments({}) };
    bookingCounts.forEach((item) => {
      counts[`${item._id}Count`] = item.count;
    });

    sendResponse(res, 200, "Success", {
      message: "Booking list retrieved successfully!",
      data: updatedList,
      documentCount: counts,
      statusCode: 200,
    });
  } catch (error) {
    console.error(error);
    sendResponse(res, 500, "Failed", {
      message: error.message || "Internal server error",
      statusCode: 500,
    });
  }
});
bookingController.get("/my-list/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const bookingList = await Booking.find({ userId: id });
    const updatedBookingList = await Promise.all(
      bookingList.map(async (v) => {
        let serviceDetails = null;
        let userDetails = null;
        if (v?.serviceType == "service") {
          serviceDetails = await Service.findOne({ _id: v?.serviceId });
        } else if (v?.serviceType == "repair") {
          serviceDetails = await Repair.findOne({ _id: v?.serviceId });
        } else if (v?.serviceType == "installation") {
          serviceDetails = await Installation.findOne({ _id: v?.serviceId });
        }
        userDetails = await User.findOne({ _id: v?.userId });
        return { ...v.toObject(), serviceDetails, userDetails };
      })
    );
    sendResponse(res, 200, "Success", {
      message: "Booking list retrieved successfully!",
      data: updatedBookingList,
      statusCode: 200,
    });
  } catch (error) {
    console.error(error);
    sendResponse(res, 500, "Failed", {
      message: error.message || "Internal server error",
      statusCode: 500,
    });
  }
});
bookingController.get("/cancel/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const bookingData = await Booking.findOne({ _id: id });
    if (bookingData?.modeOfPayment == "cod") {
      // Update the category in the database
      const updatedBooking = await Booking.findByIdAndUpdate(
        id,
        { bookingStatus: "cancel" },
        {
          new: true, // Return the updated document
        }
      );
      sendResponse(res, 200, "Success", {
        message: "Booking cancel successfully!",
        data: updatedBooking,
        statusCode: 200,
      });
    }
    if (bookingData?.modeOfPayment == "online") {
      // Update the category in the database
      const updatedBooking = await Booking.findByIdAndUpdate(
        id,
        { bookingStatus: "cancel" },
        { isRefunded: false },
        {
          new: true, // Return the updated document
        }
      );
      sendResponse(res, 200, "Success", {
        message: "Booking cancel successfully, you will get your refund within 24 hours!",
        data: updatedBooking,
        statusCode: 200,
      });
    }
  } catch (error) {
    console.error(error);
    sendResponse(res, 500, "Failed", {
      message: error.message || "Internal server error",
      statusCode: 500,
    });
  }
});
bookingController.post("/assign-vender/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const bookingData = await Booking.findOne({ _id: id });
    if (!bookingData) {
      sendResponse(res, 200, "Success", {
        message: "Booking not found!",
        data: bookingData,
        statusCode: 200,
      });
    }
    const updatedBooking = await Booking.findByIdAndUpdate(
      id,
      { venderId: req.body.venderId, bookingStatus:"venderAssigned" },
      {
        new: true, 
      }
    );
    sendResponse(res, 200, "Success", {
      message: "Vender assigned successfully!",
      data: updatedBooking,
      statusCode: 200,
    });
  } catch (error) {
    console.error(error);
    sendResponse(res, 500, "Failed", {
      message: error.message || "Internal server error",
      statusCode: 500,
    });
  }
});
bookingController.post("/mark-done/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const bookingData = await Booking.findOne({ _id: id });
    if (!bookingData) {
      sendResponse(res, 200, "Success", {
        message: "Booking not found!",
        data: bookingData,
        statusCode: 200,
      });
    }
    const updatedBooking = await Booking.findByIdAndUpdate(
      id,
      {  bookingStatus:"bookingCompleted" },
      {
        new: true, 
      }
    );
    sendResponse(res, 200, "Success", {
      message: "Booking marked as completed",
      data: updatedBooking,
      statusCode: 200,
    });
  } catch (error) {
    console.error(error);
    sendResponse(res, 500, "Failed", {
      message: error.message || "Internal server error",
      statusCode: 500,
    });
  }
});
module.exports = bookingController;

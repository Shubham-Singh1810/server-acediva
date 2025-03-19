const express = require("express");
const { sendResponse, generateOTP } = require("../utils/common");
require("dotenv").config();
const Vender = require("../model/vender.Schema");
const venderController = express.Router();
const axios = require("axios");
require("dotenv").config();
const jwt = require("jsonwebtoken");
const cloudinary = require("../utils/cloudinary");
const upload = require("../utils/multer");

venderController.post("/send-otp", async (req, res) => {
  try {
    const { phoneNumber, ...otherDetails } = req.body;
    // Check if the phone number is provided
    if (!phoneNumber) {
      return sendResponse(res, 400, "Failed", {
        message: "Phone number is required.",
        statusCode: 400,
      });
    }
    // Generate OTP
    const otp = generateOTP();

    // Check if the user exists
    let user = await Vender.findOne({ phoneNumber });

    if (!user) {
      // Create a new user with the provided details and OTP
      user = await Vender.create({
        phoneNumber,
        otp,
        ...otherDetails,
      });

      // Generate JWT token for the new user
      const token = jwt.sign({ userId: user._id, phoneNumber: user.phoneNumber }, process.env.JWT_KEY);
      // Store the token in the user object or return it in the response
      user.token = token;
      user = await Vender.findByIdAndUpdate(user.id, { token }, { new: true });
    } else {
      // Update the existing user's OTP
      user = await Vender.findByIdAndUpdate(user.id, { otp }, { new: true });
    }
    const appHash = "ems/3nG2V1H"; // Apne app ka actual hash yahan dalein

    // Properly formatted OTP message for autofill
    const otpMessage = `<#> ${otp} is your OTP for verification. Do not share it with anyone.\n${appHash}`;

    let optResponse = await axios.post(
      `https://api.authkey.io/request?authkey=${
        process.env.AUTHKEY_API_KEY
      }&mobile=${phoneNumber}&country_code=91&sid=${
        process.env.AUTHKEY_SENDER_ID
      }&company=Acediva&otp=${otp}&message=${encodeURIComponent(otpMessage)}`
    );

    if (optResponse?.status == "200") {
      return sendResponse(res, 200, "Success", {
        message: "OTP send successfully",
        data: user,
        statusCode: 200,
      });
    } else {
      return sendResponse(res, 422, "Failed", {
        message: "Unable to send OTP",
        statusCode: 200,
      });
    }
  } catch (error) {
    console.error("Error in /send-otp:", error.message);
    // Respond with failure
    return sendResponse(res, 500, "Failed", {
      message: error.message || "Internal server error.",
    });
  }
});
venderController.post("/otp-verification", async (req, res) => {
  try {
    const { phoneNumber, otp } = req.body;
    const user = await Vender.findOne({ phoneNumber: phoneNumber, otp: otp });
    if (user) {
      return sendResponse(res, 200, "Success", {
        message: "OTP verified successfully",
        data: user,
        statusCode: 200,
      });
    } else {
      return sendResponse(res, 422, "Failed", {
        message: "Wrong OTP",
        statusCode: 422,
      });
    }
  } catch (error) {
    return sendResponse(res, 500, "Failed", {
      message: error.message || "Internal server error.",
      statusCode: 500,
    });
  }
});
venderController.put("/update", upload.single("image"), async (req, res) => {
  try {
    const id = req.body._id;
    // Find the user by ID
    const userData = await Vender.findById(id);
    if (!userData) {
      return sendResponse(res, 404, "Failed", {
        message: "Vender not found",
      });
    }
    let updatedData = { ...req.body };
    if (req.body.firstName && req.body.lastName && req.body.email) {
      updatedData = { ...req.body, profileStatus: "completed" };
    }
    // Handle image upload if a new image is provided
    if (req.file) {
      let image = await cloudinary.uploader.upload(req.file.path, function (err, result) {
        if (err) {
          return err;
        } else {
          return result;
        }
      });
      updatedData = { ...req.body, image: image.url };
    }
    // Update the user in the database
    const updatedUserData = await Vender.findByIdAndUpdate(id, updatedData, {
      new: true, // Return the updated document
    });

    sendResponse(res, 200, "Success", {
      message: "Vender updated successfully!",
      data: updatedUserData,
      statusCode: 200,
    });
  } catch (error) {
    console.error(error);
    sendResponse(res, 500, "Failed", {
      message: error.message || "Internal server error",
    });
  }
});
venderController.post("/list", async (req, res) => {
  try {
    const { searchKey = "", status, pageNo = 1, pageCount = 10, sortByField, sortByOrder } = req.body;
    const query = {};
    if (status) query.profileStatus = status;
    if (searchKey) query.firstName = { $regex: searchKey, $options: "i" };
    const sortField = sortByField || "createdAt";
    const sortOrder = sortByOrder === "asc" ? 1 : -1;
    const sortOption = { [sortField]: sortOrder };
    const userList = await Vender.find(query)
      .sort(sortOption)
      .limit(parseInt(pageCount))
      .skip(parseInt(pageNo - 1) * parseInt(pageCount));
    const totalCount = await Vender.countDocuments({});
    const activeCount = await Vender.countDocuments({ profileStatus: "completed" });
    sendResponse(res, 200, "Success", {
      message: "Vender list retrieved successfully!",
      data: userList,
      documentCount: { totalCount, activeCount, inactiveCount: totalCount - activeCount },
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
venderController.post("/register", async (req, res) => {
  try {
    let userDetails = await Vender.findOne({ phoneNumber: req?.body?.phoneNumber, email: req?.body?.email });
    if (userDetails) {
      return sendResponse(res, 200, "Success", {
        message: "Email or phone number already exists",
        data: vender,
        statusCode: 200,
      });
    }
    
    let user;
    if (!userDetails) {
      const otp = generateOTP();
      const appHash = "ems/3nG2V1H"; // Apne app ka actual hash yahan dalein

      const otpMessage = `<#> ${otp} is your OTP for verification. Do not share it with anyone.\n${appHash}`;
      let optResponse = await axios.post(
        `https://api.authkey.io/request?authkey=${process.env.AUTHKEY_API_KEY}&mobile=${
          req.body.phoneNumber
        }&country_code=91&sid=${process.env.AUTHKEY_SENDER_ID}&company=Acediva&otp=${otp}&message=${encodeURIComponent(
          otpMessage
        )}`
      );
      // Create a new user with the provided details and OTP
      user = await Vender.create({
        ...req.body,
        otp,
      });

      // Generate JWT token for the new user
      const token = jwt.sign({ userId: user._id, phoneNumber: user.phoneNumber }, process.env.JWT_KEY);
      // Store the token in the user object or return it in the response
      user.token = token;
      user = await Vender.findByIdAndUpdate(user.id, { token }, { new: true });
    }
    return sendResponse(res, 200, "Success", {
      message: "Vender registered  successfully",
      data: user,
      statusCode: 200,
    });
  } catch (error) {
    return sendResponse(res, 500, "Failed", {
      message: error.message || "Internal server error.",
      statusCode: 500,
    });
  }
});
venderController.post("/login", async (req, res) => {
  try {
    let userDetails = await Vender.findOne({ phoneNumber: req?.body?.phoneNumber, password: req?.body?.password });
    if (userDetails?.isPhoneNumberVerified) {
      const otp = generateOTP();
      const appHash = "ems/3nG2V1H"; // Apne app ka actual hash yahan dalein

      const otpMessage = `<#> ${otp} is your OTP for verification. Do not share it with anyone.\n${appHash}`;
      let optResponse = await axios.post(
        `https://api.authkey.io/request?authkey=${process.env.AUTHKEY_API_KEY}&mobile=${
          req.body.phoneNumber
        }&country_code=91&sid=${process.env.AUTHKEY_SENDER_ID}&company=Acediva&otp=${otp}&message=${encodeURIComponent(
          otpMessage
        )}`
      );
      user = await Vender.findByIdAndUpdate(user.id, { otp }, { new: true });
      return sendResponse(res, 200, "Success", {
        message: "Please verify your phone number , Otp has been send to your phone",
        statusCode: 401,
      });
    }
    return sendResponse(res, 200, "Success", {
      message: "Vender logged in successfully",
      data: user,
      statusCode: 200,
    });
  } catch (error) {
    return sendResponse(res, 500, "Failed", {
      message: error.message || "Internal server error.",
      statusCode: 500,
    });
  }
});
module.exports = venderController;

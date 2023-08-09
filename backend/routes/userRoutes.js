// routes/userRoutes.js
const express = require("express");
const User = require("../models/User");
const Token = require("../models/token");
const sendEmail = require("../utils/sendEmail");
const router = express.Router();
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");

process.env.NODE_ENV = "development";
// POST /api/signup

router.post("/signup", async (req, res) => {
  const { email, password, name } = req.body;

  try {
    // Check if the email already exists in the database
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: "Email already exists" });
    }

    const newUser = new User({ email, password, name });
    const user = await newUser.save();
    console.log(user);
    const token = await new Token({
      userId: user._id,
      token: crypto.randomBytes(32).toString("hex"),
    }).save();

    const url = `${process.env.BASE_URL}users/${user._id}/verify/${token.token}`;
    await sendEmail(user.email, "Verify Email", url);

    // Generate and send the OTP in the email
    const otp = await sendEmail(
      email,
      "OTP(OneTimePassword)",
      "To verify your account please enter the OTP in our site"
    );
    user.otp = otp;
    await user.save();

    console.log(otp);

    res
      .status(201)
      .json({ message: "An Email sent to your account please verify", otp });
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
});

// POST /api/login
// server.js (continuation)
router.post("/login", async (req, res) => {
  const { email, password } = req.body;

  try {
    const user = await User.findOne({ email });
    console.log(user);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    if (!user.isVerified) {
      return res
        .status(401)
        .json({
          message:
            "Account not verified. Please check your email for verification instructions.",
        });
    }

    const isPasswordMatch = await bcrypt.compare(password, user.password);
    if (!isPasswordMatch) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const token = jwt.sign({ userId: user._id }, "secretKey", {
      expiresIn: "1h", // Token expiration time (optional)
    });

    // Return the user ID along with the token in the response
    return res.status(200).json({
      message: "Login success",
      token,
      userId: user._id,
    });
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
});

// Add more user-related routes if needed
router.get("/:id/verify/:token", async (req, res) => {
  try {
    const user = await User.findOne({ _id: req.params.id });
    if (!user) return res.status(400).send({ maessage: "Invalid Link" });
    const token = await Token.findOne({
      userId: user._id,
      token: req.params.token,
    });
    if (!token) return res.status(400).send({ message: "invalid link" });
    await User.updateOne({ _id: user._id, verified: true });
    await token.remove();
    res.status(200).send({ message: "Email verified successfully" });
  } catch (err) {}
});
// routes/userRoutes.js

// ... (other imports and code)

// POST /api/otp/validate

router.post("/otp/validate", async (req, res) => {
  const { email, otp } = req.body;

  try {
    // Check if the user with the provided email exists
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Compare the provided OTP with the OTP saved in the database for the user
    if (otp !== user.otp) {
      return res.status(400).json({ message: "Invalid OTP" });
    }

    // Mark the user as verified (you can add a verified field to your User model)
    user.verified = true;
    await user.save();

    // Generate a JWT token for the user and send it as a response
    const token = jwt.sign({ userId: user._id }, "secretKey", {
      expiresIn: "1h", // Token expiration time (optional)
    });

    return res.status(200).json({
      message: "OTP validation successful",
      token,
      userId: user._id,
    });
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
});

// ... (other routes)

module.exports = router;

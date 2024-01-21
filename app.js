const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");
const cors = require("cors");
require("dotenv").config();
const bodyParser = require("body-parser");
const nodemailer = require("nodemailer");

const User = require("./models/User");
const Admin = require("./models/Admin");

const app = express();
app.use(express.json());
app.use(cors('*'));
app.use(bodyParser.json());


mongoose
  .connect("mongodb+srv://GVPRENEUR:GVPRENEUR@gvpreneur.ejmi6eq.mongodb.net/", {
    useNewUrlParser: true,
  })
  .then(() => console.log("Connected to MongoDB"))
  .catch((err) => console.error("Could not connect to MongoDB", err));

  const generateOtp = () => {
    return Math.floor(100000 + Math.random() * 900000).toString();
  };

  const transporter = nodemailer.createTransport({
           host: 'smtp.gmail.com',
           port: 587,
           auth: {
             user: process.env.EMAIL_USER, 
             pass: process.env.EMAIL_PASSWORD 
           }
   })


app.post("/api/register", async (req, res) => {
  const { username, email, password, address, mobile, role } = req.body;
  
  try {
      let existingUser;
      if (role === "admin") {
          existingUser = await Admin.findOne({ email });
          if (existingUser) {
              return res.status(400).send({ message: "Email already exists" });
          }

          const admin = new Admin({
              username,
              email,
              mobile,
              password: await bcrypt.hash(password, 10),
              address,
          });

          await admin.save();
          res.status(201).send({ message: "Admin created successfully" });
      } else if (role === "user") {
          existingUser = await User.findOne({ email });
          if (existingUser) {
              return res.status(400).send({ message: "Email already exists" });
          }
          const user = new User({
              username,
              email,
              mobile,
              password: await bcrypt.hash(password, 10),
              address,
          });

        await user.save();
        res.status(201).send({ message: "User has been created successfully" });
      }
      
  } catch (err) {
    console.error("Registration failed", err);
      res.status(400).send({ message: "Registration failed", error: err });
  }
});

app.post("/api/send-otp", async (req, res) => {
  const { email } = req.body;

  try {
    /// Generate OTP for the first-time registration
    const otp = generateOtp();
    /// Send OTP via email
    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: email,
      subject: 'Your OTP for GVPRENEUR WEBSITE',
      html: `<p>Your OTP for registration is: <strong>${otp}</strong></p>`,
    };

    const info = await transporter.sendMail(mailOptions);
    console.log("OTP message sent: %s", info.messageId);

    res.status(200).json({ otp, message: "OTP has been sent successfully" });
  } catch (err) {

    console.error("Sending OTP failed", err);
    res.status(500).send({ message: "Sending OTP failed", error: err });
  }
});

const generateAccessToken = (userId) => {
  return jwt.sign({ userId }, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '300m' });
};

const authenticateToken = async (req, res, next) => {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];

  if (!token) {
    return res.status(401).send({ message: "No access token provided" });
  }
  try {
    const decodedToken = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);
    const user = await User.findOne({ _id: decodedToken.userId });
    if (!user) {
      return res.status(401).send({ message: "User not found" });
    }
    req.user = { userId: user._id, username: user.username };
    next();
  } catch (err) {
    return res.status(403).send({ message: "Invalid token" });
  }
};

function generateAdminAccessToken(adminId) {
  const payload = {
    adminId,
    role: "admin"
  };
  return jwt.sign(payload, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '300m' });
}

const authenticateAdminToken = async (req, res, next) => {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];

  if (!token) {
    return res.status(401).send({ message: "No access token provided" });
  }

  try {
    const decodedToken = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);
    const admin = await Admin.findOne({ _id: decodedToken.adminId });
    if (!admin) {
      return res.status(401).send({ message: "Found no admin" });
    }
    req.admin = { adminId: admin._id, username: admin.username };
    next();
  } catch (err) {
    return res.status(403).send({ message: "Invalid token" });
  }
};

app.post('/api/token', (req, res) => {
  const refreshToken = req.cookies.refreshToken;
  if (!refreshToken) {
    return res.status(401).send({ message: 'No refresh token provided' });
  }
  jwt.verify(refreshToken, process.env.REFRESH_TOKEN_SECRET, (err, user) => {
    if (err) {
      if (err instanceof jwt.TokenExpiredError) {
        return res.status(403).send({ message: 'Refresh token expired' });
      } else {
        return res.status(403).send({ message: 'Invalid refresh token' });
      }
    }
    const accessToken = generateAccessToken(user.userId);
    res.send({ accessToken });
  });
});

app.post("/api/login", async (req,res) =>{
  const { email, password, role} = req.body;
  let user;
  if (role === "user") {
    user = await User.findOne({ email });
  } else if (role === "admin") {
    user = await Admin.findOne({ email });
  }
  if (!user) {
    return res.status(401).send({ message: "User with email not found" });
  }
  const isMatch = await bcrypt.compare(password, user.password);
  if (!isMatch) {
    return res.status(401).send({ message: " password is incorrect" });
  }
  let accessToken;
  if (role === "user") {
    accessToken = generateAccessToken(user._id);
  } else if (role === "admin") {
    accessToken = generateAdminAccessToken(user._id);
  }
  if (role === "user") {
    const refreshToken = jwt.sign({ userId: user._id }, process.env.REFRESH_TOKEN_SECRET);
    res.cookie("refreshToken", refreshToken, {
      httpOnly: true,
      path: "/api/token",
    });
    res.status(201).send({ accessToken, userId: user._id, message: "User logged in successfully" });
  }
  else if (role === "admin") {
    const refreshToken = jwt.sign({ adminId: user._id }, process.env.REFRESH_TOKEN_SECRET);
    res.cookie("refreshToken", refreshToken, {
      httpOnly: true,
      path: "/api/token",
    });
    res.status(201).send({ accessToken, adminId: user._id, message: "admin logged in successfully" });
  }

 })

app.listen(3005, () => console.log("Server listening on port 3005"));

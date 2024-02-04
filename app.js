const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");
const cors = require("cors");
require("dotenv").config();
const bodyParser = require("body-parser");
const nodemailer = require("nodemailer");
const axios = require('axios');

const crypto = require('crypto');
const sha256 = crypto.createHash('sha256');
const hmacSHA512 = crypto.createHmac('sha512', 'your-secret-key');

const User = require("./models/User");
const Admin = require("./models/Admin");
const Course = require("./models/Course");

const app = express();
app.use(express.json());
app.use(cors('*'));
app.use(bodyParser.json());


mongoose
  .connect(process.env.MONGODB_URI, {
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


const authenticateEitherToken = async (req, res, next) => {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];

  if (!token) {
    return res.status(401).send({ message: "No access token provided" });
  }

  try {
    // Try decoding as a user token
    const decodedUserToken = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);
    const user = await User.findOne({ _id: decodedUserToken.userId });
    if (user) {
      req.user = { userId: user._id, username: user.username };
      return next();
    }

    // If decoding as a user token fails, try decoding as an admin token
    const decodedAdminToken = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);
    const admin = await Admin.findOne({ _id: decodedAdminToken.adminId });
    if (admin) {
      req.admin = { adminId: admin._id, username: admin.username };
      return next();
    }

    // If neither user nor admin token is valid
    return res.status(401).send({ message: "Invalid token" });
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
 });
 
///khalti API incomplete
app.post("/api/make-payment", async (req, res) => {
  const apiKey = process.env.KHALTI_API_KEY; 

  const apiUrl = 'https://a.khalti.com/api/v2/epayment/initiate/';

  const requestBody = {
      return_url: req.body.return_url,
      website_url: req.body.website_url,
      amount: req.body.amount,
      purchase_order_id: req.body.purchase_order_id,
      purchase_order_name: req.body.purchase_order_name
  };
  console.log(requestBody);
  const headers = {
      'Authorization': `${apiKey}`,
      'Content-Type': 'application/json'
  };
  try {
      const response = await axios.post(apiUrl, requestBody, { headers });
      console.log('Khalti API response:', response.data);
      res.status(200).json(response.data);
      console.log(response.data)
  } catch (error) {
      console.error('Error making Khalti API request:', error.message);
      res.status(500).json({ error: 'Internal Server Error' });
  }
});


///create a function with crypto js for esewa
const createSignature = (message) => {
  const secret = "8gBm/:&EnhH.1/q";

  const hmac = crypto.createHmac("sha256", secret);
  hmac.update(message);

  //Get the digest in base64 format
  const hashInBase64 = hmac.digest("base64");
  console.log(hashInBase64)
  return hashInBase64;
}

app.post("/api/e-sewa", async (req, res ) => {
  try {
    const signature = createSignature (
    ` total_amount= 100, transaction_uuid="ab14a8f2b02c3",product_code="EPAYTEST" `
    );
    console.log(total_amount)
    const formData = {
      amount: "100",
      failure_url: "https://google.com",
      product_delivery_charge: "0" ,
      product_service_charge:  "0" ,
      product_code:  "EPAYTEST" ,
      signature :  signature,
      signed_field_names : "total_amount,transaction_uuid,product_code",
      success_url : "https://esewa.com.np" ,
      tax_amount :  "0",
      total_amount :  "100" ,
      transaction_uuid :  "ab14a8f2b02c3"
    };
    console.log(formData)
    res.status(200).json({message: "Order created successfully"}, formData)
  }
  catch (err){
    res.status(400).json({error: err?.message || "no orders found"})

  }
})

/// create course from admin
// Route to create a new course (requires admin authentication)
 app.post('/api/create-course', authenticateAdminToken, async (req, res) => {
    try {
      const { title, description, link, startDate, endDate, speaker, host } = req.body;

      const newCourse = new Course({
        title,
        description,
        link,
        startDate,
        endDate,
        speaker,
        host,
        isLocked: true, /// By default, new courses are locked until manually unlocked
      });

      /// Save the course to the database
      await newCourse.save();
      res.status(201).json({ message: 'Course created successfully.', courseId: newCourse._id });
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: 'Internal server error.' });
    }
  });

  app.delete('/api/delete-course/:courseId', authenticateAdminToken, async (req, res) => {
    try {
      const courseId = req.params.courseId;
  
      const course = await Course.findById(courseId);
      if (!course) {
        return res.status(404).json({ message: 'Course not found.' });
      }
  
      await Course.findByIdAndDelete(courseId);
  
      res.status(200).json({ message: 'Course deleted successfully.' });
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: 'Internal server error.' });
    }
  });

  app.put('/api/edit-course/:courseId', authenticateAdminToken, async (req, res) => {
    try {
      const courseId = req.params.courseId;
  
      const course = await Course.findById(courseId);
      if (!course) {
        return res.status(404).json({ message: 'Course not found.' });
      }
  
      const { title, description, link, startDate, endDate, speaker, host } = req.body;
      course.title = title;
      course.description = description;
      course.link = link;
      course.startDate = startDate;
      course.endDate = endDate;
      course.speaker = speaker;
      course.host = host;
  
      await course.save();
  
      res.status(201).json({ message: 'Course updated successfully.', courseId: course._id });
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: 'Internal server error.' });
    }
  });

  app.get('/api/get-course/', authenticateAdminToken, async (req, res) => {
    try {
      const course = await Course.find({});
  
      if (!course) {
        return res.status(404).json({ message: 'Course not found.' });
      }
  
      res.status(201).json({
        message: 'Course details retrieved successfully.',
        course: course.map(course => ({
          id: course._id,
          title: course.title,
          description: course.description,
          link: course.link,
          startDate: course.startDate,
          endDate: course.endDate,
          speaker: course.speaker,
          host: course.host,
          attendees: course.attendees,
        }))
      });
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: 'Internal server error.' });
    }
  });
  
  app.get('/api/get-course/:courseId', authenticateEitherToken, async (req, res) => {
    try {
      const courseId = req.params.courseId;
  
      const course = await Course.findById(courseId).populate('attendees');
  
      if (!course) {
        return res.status(404).json({ message: 'Course not found.' });
      }
  
      res.status(201).json({
        message: 'Course details retrieved successfully.',
        course: {
          title: course.title,
          description: course.description,
          link: course.link,
          startDate: course.startDate,
          endDate: course.endDate,
          speaker: course.speaker,
          host: course.host,
          attendees: course.attendees,
        },
      });
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: 'Internal server error.' });
    }
  });



app.listen(3005, () => console.log("Server listening on port 3005"));

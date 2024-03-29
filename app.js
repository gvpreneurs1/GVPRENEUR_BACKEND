const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");
const cors = require("cors");
require("dotenv").config();
const bodyParser = require("body-parser");
const nodemailer = require("nodemailer");
const axios = require('axios');
const uuid = require('uuid')

const crypto = require("node:crypto");

const User = require("./models/User");
const Admin = require("./models/Admin");
const Course = require("./models/Course");
const Notification = require("./models/Notification");
const Message = require("./models/Message");

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

 // blaze-sewa 
  const { ESEWA_SECRET, ESEWA_LINK } = process.env
  const SIGNED_FIELDS = ["total_amount", "transaction_uuid", "product_code"]  

  const generateSignature = (message) => {
   const hash = crypto.createHmac("sha256", ESEWA_SECRET)

   hash.update(message)
   const hashInBase64 = hash.digest("base64")

   return hashInBase64
  }

  const checkIfValuesOfSignatureArePresent = (product) => {
    for (const field of SIGNED_FIELDS) {
      if (!product[field]) return false
    }
  
    return true
  }

  const generateSignedInput = (product) => {
    const signedInputs = SIGNED_FIELDS.map(field => {
      return `${field}=${product[field]}`
    })
  
    return signedInputs.join(",")
  }

  app.post("/api/esewa/payload", async (req,res) => {
    const product = req.body

    product.transaction_uuid = uuid.v4()
    if (!checkIfValuesOfSignatureArePresent) {
      return res.status(400).send({ success: false, message: "Values unmet"})
    }

    const signedInput = generateSignedInput(product)

    product.signature = generateSignature(signedInput)
    res.status(200).send({ success: true, formData: product, esewaLink: ESEWA_LINK })
  })

  const decodeBase64ToASCII = (base64Input) => {
    const decodedValue = Buffer.from(base64Input, 'base64').toString('ascii')
  
    return decodedValue
  }


  //middleware for sucess eseewa
  // const handleEsewaSuccess = async (req,res,next) => {
  //   try {
  //   const { data } = req.query;
  //   const decodedData = JSON.parse(
  //     Buffer.from(data, "base64").toString("utf-8")
  //   );
  //   console.log(decodedData);

  //   if (decodedData.status !== "COMPLETE") {
  //     return res.status(400).json({ messgae: "errror" });
  //   }
  //   const message = decodedData.signed_field_names
  //     .split(",")
  //     .map((field) => `${field}=${decodedData[field] || ""}`)
  //     .join(",");
  //   console.log(message);
  //   const signature = generateSignature(message);

  //   if (signature !== decodedData.signature) {
  //     res.status(422).json({ message: "integrity error" });
  //   }
  //   next();
  // } catch (err) {
  //   console.log(err);
  //   return res.status(400).json({ error: err?.message || "No Orders found" });
  // }}

  app.get("/api/esewa-success/:userId/:courseId", async (req, res) => {
    try {
      console.log(req.body);
      res.redirect(`http://localhost:3000/CoursePost`);
    } catch (err) {
      return res.status(400).json({ error: err?.message || "No Orders found" });
    }
  });

  app.post('/api/add-user-course/:userId/:courseId', async (req, res) => {
    try {
        const userId = req.params.userId;
        const courseId = req.params.courseId;

        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        const course = await Course.findById(courseId);
        if (!course) {
            return res.status(404).json({ error: 'Course not found' });
        }

        if (course.attendees.includes(userId)) {
          return res.status(409).json({ error: 'User is already present'});
        }

        course.attendees.push(user);

        await course.save();

        res.status(201).json({ message: 'User added to course successfully.', userId: user._id });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Internal server error.' });
    }
});

  app.post("/api/completeOrder/:base64Input", async (req,res) => {
    const base64Input = req.params.base64Input
    const decodedInput = decodeBase64ToASCII(base64Input)

    res.status(200).send({ success: true, decodedInput })
  })



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



/// Course System
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
  
      res.status(201).json({ message: 'Course deleted successfully.' });
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

  app.get('/api/get-course/', async (req, res) => {
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

  app.get('/api/get-course/:id', async (req, res) => {
    try {
      const courseId = req.params.id;
      const course = await Course.findById(courseId).populate('attendees', 'username email mobile');
  
      if (!course) {
        return res.status(404).json({ message: 'Course not found.' });
      }
  
      const courseData = {
        id: course._id,
        title: course.title,
        description: course.description,
        link: course.link,
        startDate: course.startDate,
        endDate: course.endDate,
        speaker: course.speaker,
        host: course.host,
        attendees: course.attendees.map(attendee => ({
          id: attendee._id, 
          username: attendee.username,
          email: attendee.email,
          mobile: attendee.mobile,
        })),
      };
  
      res.status(201).json({
        message: 'Course details retrieved successfully.',
        course: courseData,
      });
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: 'Internal server error.' });
    }
  });
  
  
  ///Ended Course System

  ///Notification system
  app.post('/api/send-notification', authenticateAdminToken, async (req, res) => {
    const { adminId, message, title } = req.body;
  
    try {
      const isAdmin = await Admin.findById(adminId);
      if (!isAdmin) {
        return res.status(401).json({ error: 'Unauthorized' });
      }
  
      // Get all users (for simplicity, you might have a different logic)
      const users = await User.find();
      // Send a notification to each user
      const notifications = await Promise.all(
        users.map(async (user) => {
          const notification = new Notification({ userId: user._id, message, title});
          await notification.save();
          user.notifications.push(notification);
          await user.save();
          return notification;
        })
      );
  
      res.status(201).json({ success: true, notifications});
    } catch (error) {
      console.error('Error sending notification:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });
  
  app.get('/api/get-notifications/:userId', async (req, res) => {
    const { userId } = req.params;

    try {
      const user = await User.findById(userId).populate('notifications');
      if (!user) {
        return res.status(401).json({ error: 'User not found' });
      }


      const messages = user.notifications.map(notification => (
        notification.message));

      const title = user.notifications.map(notification => (
          notification.title));

      const ID = user.notifications.map(notification => (
        notification._id
      ));

      const notificationCount = user.notifications.length;

      res.status(201).json({ messages , ID, title, notificationCount });
    } catch (error) {
      console.error('Error fetching notifications:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });
  

  app.delete('/api/delete-notifications/:userId/:notificationId', async (req,res) => {
    const { userId, notificationId } = req.params;
    try {
      const user = await User.findById(userId);
      if (!user) {
        res.status(404).json({ message: 'user not found '});
      }
      const notification = await Notification.findById(notificationId);
      if (!notification) {
        res.status(404).json({ message: 'notification not found'});
      }
      
      await Notification.findByIdAndDelete(notificationId);

      res.status(201).json({ message: "Deleted sucessfully"});
    }
    catch (error) {
      console.log(error)
      res.status(500).json({message: 'Message was not deleted'});
    }
  });


  ///End of notification system

  ///User profile system
  
  app.get('/api/get-user/', async (req,res) => {
    try{
      const user = await User.find({});
      if(!user) {
        return res.status(404).json( {message:'User not found '});
      }
     res.status(201).json({
      user: user.map(user => ({
        username : user.username,
        email: user.email,
        mobile: user.mobile,
        password: user.password,
        address: user.address
      }))
     })
    }
    catch(error) {
      console.log(error)
      res.status(500).json({ message: 'find the user'})
    }
  })

  app.get('/api/get-user/:userId', async (req,res) => {
    const {userId} = req.params;
    try{
      const user = await User.findById(userId);
      if(!user) {
        return res.status(404).json( {message:'User not found '});
      }
     res.status(201).json({
      user: {
        username : user.username,
        email: user.email,
        mobile: user.mobile,
        password: user.password,
        address: user.address
      }
     })
    }
    catch(error) {
      console.log(error)
      res.status(500).json({ message: 'find the user'})
    }
  })
  
  app.put('/api/update-user/:userId', async (req, res) => {
    const { userId } = req.params;
    const { username, email, mobile, password, address } = req.body;
  
    try {
      const user = await User.findById(userId);
      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }
  
      // Update user properties
      user.username = username || user.username;
      user.email = email || user.email;
      user.mobile = mobile || user.mobile;
      user.password = password || user.password;
      user.address = address || user.address;
  
      // Save the updated user
      await user.save();
  
      res.status(200).json({
        user: {
          username: user.username,
          email: user.email,
          mobile: user.mobile,
          password: user.password,
          address: user.address,
        },
        message: 'User updated successfully',
      });
    } catch (error) {
      console.log(error);
      res.status(500).json({ message: 'Error updating user' });
    }
  });

  app.delete('/api/delete-user/:userId', async (req, res) => {
    const { userId } = req.params;
  
    try {
      const user = await User.findById(userId);
      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }
  
      // Delete the user
      await user.remove();
  
      res.status(200).json({ message: 'User deleted successfully' });
    } catch (error) {
      console.log(error);
      res.status(500).json({ message: 'Error deleting user' });
    }
  });

  //Contact us form

  app.post('/api/save-message', async (req, res) => {
    try {
      const { name, email, message } = req.body;
  
      // Validate if required fields are present
      if (!name || !email || !message) {
        return res.status(400).json({ error: 'Name, email, and message are required fields' });
      }
  
      // Create a new Message document
      const newMessage = new Message({
        name,
        email,
        message,
      });
  
      // Save the message to the database
      await newMessage.save();
  
      res.status(201).json({ message: 'Message saved successfully' });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  app.get('/api/get-message', async (req,res) => {
    try {
    const messages = await Message.find({});
    if (!messages){
      return res.status(404).json({ message: 'message not found'});
    }
    res.status(201).json({
      messages: messages.map(messages => ({
        id: messages._id,
        name: messages.name,
        email: messages.email,
        message: messages.message
      }))
    })
    }
    catch {
      return res.status(401).json({message:'meesages cannot be retrieved'})
    }
  });



app.listen(3005, () => console.log("Server listening on port 3005"));

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
          existingUser = await Admin.findOne({ username });
          if (existingUser) {
              return res.status(400).send({ message: "Admin already exists" });
          }

          const admin = new Admin({
              username,
              email,
              mobile,
              password,
              address,
          });

          await admin.save();
          res.status(201).send({ message: "Admin created successfully" });
      } else if (role === "user") {
          existingUser = await User.findOne({ username });
          if (existingUser) {
              return res.status(400).send({ message: "Email already exists" });
          }

          const otp = generateOtp();

          const user = new User({
              username,
              email,
              mobile,
              password,
              address,
          });

          res.status(201).send({ message: "User created successfully" });

        const mailOptions = {
        from: process.env.EMAIL_USER,
        to: req.body.email,
        subject: 'Your OTP for GVPRENEUR WEBSITE',
        html: `<p>Your OTP for registration is: <strong>${otp}</strong></p>`,
        };

    const info = await transporter.sendMail(mailOptions);

    console.log("Test message sent: %s", info.messageId);
      }
  } catch (err) {
    console.error("Registration failed", err);
      res.status(400).send({ message: "Registration failed", error: err });
  }
});


 app.post("/api/login", async (req,res) =>{
  const { email, password} = req.body;
  let user;
  user = await User.findOne({ email });
  if (!user) {
    return res.status(401).send({ message: "Username or password is incorrect" });
  }
  const isMatch = await bcrypt.compare(password, user.password);
  if (!isMatch) {
    return res.status(401).send({ message: "Username or password is incorrect" });
  }
  if (!user.confirmed) {  
    return res.status(401).send({ message: "confirmation is incorrect" });
  }
 })

app.listen(3005, () => console.log("Server listening on port 3005"));

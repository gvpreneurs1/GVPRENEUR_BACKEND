const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");
const cors = require("cors");
require("dotenv").config();
const bodyParser = require("body-parser");

const User = require("./models/User");
const Admin = require("./models/Admin");

const app = express();
app.use(express.json());
app.use(cors('*'));
app.use(bodyParser.json());


mongoose
  .connect("mongodb+srv://GVPRENEUR:GVPRENEUR@gvpreneur.tqkley3.mongodb.net/", {
    useNewUrlParser: true,
  })
  .then(() => console.log("Connected to MongoDB"))
  .catch((err) => console.error("Could not connect to MongoDB", err));
  
  app.post("/api/register", async (req, res) => {
    const { username, email, password, address, mobile, role} = req.body;
   
    if (role === "admin") {
      const adminExists = await Admin.findOne({ username });
      if (adminExists) {
        return res.status(400).send({ message: "admin already exists" });
      }
      const admin = new Admin({
        username,
        email,
        mobile,
        password,
        address,
      });
      try {
        await admin.save();
        res.status(201).send({ message: "Admin created successfully" });
      } catch (err) {
        res.status(400).send({ message: "Admin creation failed", error: err });
      }
    } else if (role === "user") {
      const userExists = await User.findOne({ username });
      if (userExists) {
        return res.status(400).send({ message: "Username already exists" });
      }
      const user = new User({
        username,
        email,
        mobile,
        password,
        address,
      });
      try {
        await user.save();
        res.status(201).send({ message: "User created successfully" });
      } catch (err) {
        res.status(400).send({ message: "User creation failed", error: err });
      }
    }
  });

app.listen(3005, () => console.log("Server listening on port 3005"));

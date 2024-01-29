const mongoose = require('mongoose');

const adminSchema = new mongoose.Schema({
  username: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  mobile: { type: String, required: true },
  password: { type: String, required: true },
  address: { type: String, required: true },
  createdCourses: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Course' }],
});

const Admin = mongoose.model('Admin', adminSchema);

module.exports = Admin;
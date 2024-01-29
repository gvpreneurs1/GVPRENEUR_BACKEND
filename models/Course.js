const mongoose = require('mongoose');

const courseSchema = new mongoose.Schema({
  title: { type: String, required: true },
  description: { type: String, required: true },
  link: { type: String }, 
  startDate: { type: Date, required: true },
  endDate: { type: Date, required: true },
  speaker: { type: String },
  host: { type: String },
  attendees: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  isLocked: { type: Boolean, default: true },
});

const Course = mongoose.model('Course', courseSchema);

module.exports = Course;
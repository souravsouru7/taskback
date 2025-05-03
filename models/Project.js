const mongoose = require("mongoose");

const projectSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      required: true,
    },
    client: {
      name: String,
      email: String,
      phone: String,
    },
    startDate: {
      type: Date,
      required: true,
    },
    endDate: {
      type: Date,
      required: true,
    },
    status: {
      type: String,
      enum: ["planning", "in-progress", "review", "completed", "on-hold"],
      default: "planning",
    },
    budget: {
      type: Number,
      required: true,
    },
    team: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],
    projectManager: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    documents: [
      {
        name: String,
        url: String,
        type: String,
        uploadedBy: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
        },
        uploadedAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],
    milestones: [
      {
        title: String,
        description: String,
        dueDate: Date,
        completed: {
          type: Boolean,
          default: false,
        },
        completedAt: Date,
      },
    ],
    createdAt: {
      type: Date,
      default: Date.now,
    },
    updatedAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    // Enable virtuals for JSON and Object conversions
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Virtual field to establish relationship with tasks
projectSchema.virtual("tasks", {
  ref: "Task", // The Model to use
  localField: "_id", // Find tasks where `localField`
  foreignField: "project", // is equal to this field in Task model
});

// Update the updatedAt timestamp before saving
projectSchema.pre("save", function (next) {
  this.updatedAt = Date.now();
  next();
});

module.exports = mongoose.model("Project", projectSchema);

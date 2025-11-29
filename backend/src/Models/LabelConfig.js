const mongoose = require("mongoose");

const labelConfigSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    baseName: {
      type: String,
      required: true,
      trim: true,
    },
    startNumber: {
      type: Number,
      required: true,
      min: 0,
    },
    quantity: {
      type: Number,
      required: true,
      min: 1,
      max: 1000,
    },
    codeType: {
      type: String,
      required: true,
      enum: ["barcode", "qrcode", "datamatrix"],
      default: "barcode",
    },
    labelSize: {
      width: {
        type: Number,
        default: 50, // mm
      },
      height: {
        type: Number,
        default: 50, // mm
      },
    },
    isTemplate: {
      type: Boolean,
      default: false,
    },
    createdBy: {
      type: String,
      default: "system",
    },
    lastUsed: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

// Index for faster queries
labelConfigSchema.index({ baseName: 1, createdAt: -1 });
labelConfigSchema.index({ isTemplate: 1 });

// Virtual for getting the pattern
labelConfigSchema.virtual("pattern").get(function () {
  const match = this.baseName.match(/^(.+?)(\d+)$/);
  if (match) {
    return {
      prefix: match[1],
      numberLength: match[2].length,
    };
  }
  return null;
});

// Method to generate codes
labelConfigSchema.methods.generateCodes = function () {
  const codes = [];
  const match = this.baseName.match(/^(.+?)(\d+)$/);

  if (!match) {
    throw new Error("Invalid base name format");
  }

  const prefix = match[1];
  const startNum = parseInt(match[2]);
  const numLength = match[2].length;

  for (let i = 0; i < this.quantity; i++) {
    const currentNum = startNum + i;
    const paddedNum = String(currentNum).padStart(numLength, "0");
    codes.push(prefix + paddedNum);
  }

  return codes;
};

const LabelConfig = mongoose.model("LabelConfig", labelConfigSchema);

module.exports = LabelConfig;

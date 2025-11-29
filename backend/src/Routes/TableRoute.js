const express = require("express");
const router = express.Router();
const LabelConfig = require("../Models/LabelConfig");
const GeneratedLabel = require("../Models/TableModel");

// Create new label configuration
router.post("/", async (req, res) => {
  try {
    const { name, baseName, quantity, codeType, isTemplate, createdBy } =
      req.body;

    // Validate baseName format
    const match = baseName.match(/^(.+?)(\d+)$/);
    if (!match) {
      return res.status(400).json({
        error:
          "Invalid base name format. Must end with numbers (e.g., PA00001)",
      });
    }

    const startNumber = parseInt(match[2]);

    const labelConfig = new LabelConfig({
      name: name || `Config-${baseName}`,
      baseName,
      startNumber,
      quantity,
      codeType: codeType || "barcode",
      isTemplate: isTemplate || false,
      createdBy: createdBy || "system",
    });

    await labelConfig.save();

    res.status(201).json({
      success: true,
      message: "Label configuration created successfully",
      data: labelConfig,
    });
  } catch (error) {
    console.error("Error creating label config:", error);
    res.status(500).json({
      error: "Failed to create label configuration",
      message: error.message,
    });
  }
});

// Get all label configurations
router.get("/", async (req, res) => {
  try {
    const { page = 1, limit = 10, isTemplate } = req.query;
    const query = {};

    if (isTemplate !== undefined) {
      query.isTemplate = isTemplate === "true";
    }

    const configs = await LabelConfig.find(query)
      .sort({ lastUsed: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .exec();

    const count = await LabelConfig.countDocuments(query);

    res.json({
      success: true,
      data: configs,
      totalPages: Math.ceil(count / limit),
      currentPage: page,
      total: count,
    });
  } catch (error) {
    console.error("Error fetching label configs:", error);
    res.status(500).json({
      error: "Failed to fetch label configurations",
      message: error.message,
    });
  }
});

// Get single label configuration by ID
router.get("/:id", async (req, res) => {
  try {
    const config = await LabelConfig.findById(req.params.id);

    if (!config) {
      return res.status(404).json({ error: "Configuration not found" });
    }

    res.json({
      success: true,
      data: config,
    });
  } catch (error) {
    console.error("Error fetching label config:", error);
    res.status(500).json({
      error: "Failed to fetch label configuration",
      message: error.message,
    });
  }
});

// Generate codes from configuration
router.post("/:id/generate", async (req, res) => {
  try {
    const config = await LabelConfig.findById(req.params.id);

    if (!config) {
      return res.status(404).json({ error: "Configuration not found" });
    }

    const codes = config.generateCodes();

    // Optionally save generated labels to database
    const saveToDB = req.body.saveToDB === true;

    if (saveToDB) {
      const labelDocs = codes.map((code, index) => ({
        code,
        codeType: config.codeType,
        configId: config._id,
        baseName: config.baseName,
        sequenceNumber: config.startNumber + index,
        status: "generated",
      }));

      await GeneratedLabel.insertMany(labelDocs, { ordered: false }).catch(
        (err) => {
          // Ignore duplicate key errors
          if (err.code !== 11000) throw err;
        }
      );
    }

    // Update last used timestamp
    config.lastUsed = new Date();
    await config.save();

    res.json({
      success: true,
      data: {
        codes,
        count: codes.length,
        config: {
          id: config._id,
          name: config.name,
          baseName: config.baseName,
          codeType: config.codeType,
        },
      },
    });
  } catch (error) {
    console.error("Error generating codes:", error);
    res.status(500).json({
      error: "Failed to generate codes",
      message: error.message,
    });
  }
});

// Update label configuration
router.put("/:id", async (req, res) => {
  try {
    const { name, quantity, codeType, isTemplate } = req.body;

    const config = await LabelConfig.findByIdAndUpdate(
      req.params.id,
      {
        name,
        quantity,
        codeType,
        isTemplate,
        lastUsed: new Date(),
      },
      { new: true, runValidators: true }
    );

    if (!config) {
      return res.status(404).json({ error: "Configuration not found" });
    }

    res.json({
      success: true,
      message: "Configuration updated successfully",
      data: config,
    });
  } catch (error) {
    console.error("Error updating label config:", error);
    res.status(500).json({
      error: "Failed to update configuration",
      message: error.message,
    });
  }
});

// Delete label configuration
router.delete("/:id", async (req, res) => {
  try {
    const config = await LabelConfig.findByIdAndDelete(req.params.id);

    if (!config) {
      return res.status(404).json({ error: "Configuration not found" });
    }

    res.json({
      success: true,
      message: "Configuration deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting label config:", error);
    res.status(500).json({
      error: "Failed to delete configuration",
      message: error.message,
    });
  }
});

// Get recently used configurations
router.get("/recent/list", async (req, res) => {
  try {
    const { limit = 5 } = req.query;

    const configs = await LabelConfig.find()
      .sort({ lastUsed: -1 })
      .limit(parseInt(limit));

    res.json({
      success: true,
      data: configs,
    });
  } catch (error) {
    console.error("Error fetching recent configs:", error);
    res.status(500).json({
      error: "Failed to fetch recent configurations",
      message: error.message,
    });
  }
});

module.exports = router;

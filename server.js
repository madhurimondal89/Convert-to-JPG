const express = require('express');
const multer = require('multer');
const sharp = require('sharp');
const archiver = require('archiver');
const path = require('path');

const app = express();
const port = 3000;

const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

app.use(express.static('public'));

// Endpoint 1: একটিমাত্র ফাইল কনভার্ট করার জন্য
app.post('/convert-single', upload.single('image'), async (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded.' });
    }

    try {
        const outputBuffer = await sharp(req.file.buffer)
            .jpeg({ quality: 90 })
            .toBuffer();
        
        res.set('Content-Type', 'image/jpeg');
        res.send(outputBuffer);

    } catch (err) {
        console.error(`Failed to convert file:`, err);
        res.status(500).json({ error: 'Failed to convert the image.' });
    }
});


// Endpoint 2: একাধিক ফাইলকে ZIP করার জন্য
app.post('/convert-and-zip', upload.array('images'), async (req, res) => {
    if (!req.files || req.files.length === 0) {
        return res.status(400).send('No files were uploaded.');
    }

    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', 'attachment; filename=converted-images.zip');

    const archive = archiver('zip', { zlib: { level: 9 } });
    archive.on('error', (err) => res.status(500).send({ error: err.message }));
    archive.pipe(res);

    for (const file of req.files) {
        try {
            const originalName = path.parse(file.originalname).name;
            const outputFileName = `${originalName}.jpg`;
            const outputBuffer = await sharp(file.buffer)
                .jpeg({ quality: 90 })
                .toBuffer();
            archive.append(outputBuffer, { name: outputFileName });
        } catch (err) {
            console.error(`Failed to convert ${file.originalname}:`, err);
            archive.append(`Could not convert ${file.originalname}.`, { name: `error-${file.originalname}.txt` });
        }
    }

    await archive.finalize();
});


app.listen(port, () => {
    console.log(`Server is running at http://localhost:${port}`);
});
const video = document.getElementById("video");

Promise.all([
    faceapi.nets.ssdMobilenetv1.loadFromUri('/recognize_user/models'),
    faceapi.nets.faceLandmark68Net.loadFromUri('/recognize_user/models'),
    faceapi.nets.faceRecognitionNet.loadFromUri('/recognize_user/models'),
]).then(() => {
    startWebcam();
}).then(() => faceRecognition())


function startWebcam() {
    navigator.mediaDevices.getUserMedia({ video : true, audio: false})
    .then((stream) => {
        video.srcObject = stream;
    }).catch((err) => {
        console.error(err);
    })
}

async function getLabeledFaceDescriptions(labels) {
    const userPhotos = getPhotoIds();     
    const labeledFaceDescriptors = [];
    const apiKey = fetch('/api/flickrApiKey')
    for (let i = 0; i < labels.length; i++) {
        const label = labels[i].toString();
        const user = users.find(user => user.id === label);

        if (user && user.photoID) {
            const descriptions = [];
            const image = await faceapi.fetchImage(`https://live.staticflickr.com/${user.photoID}.jpeg?api_key=${apiKey}`);
            const detections = await faceapi
                .detectSingleFace(image)
                .withFaceLandmarks()
                .withFaceDescriptor();
            descriptions.push(detections.descriptor);

            labeledFaceDescriptors.push(new faceapi.LabeledFaceDescriptors(label, descriptions));
        }
    }

    return labeledFaceDescriptors;
        //return Promise.all(
        //labels.map(async (label) => {
        //    const descriptions = [];
        //    const image = await faceapi.fetchImage(`/recognize_user/labels/${label}/${label}.jpeg`);
        //    const detections = await faceapi
        //        .detectSingleFace(image)
        //        .withFaceLandmarks()
        //        .withFaceDescriptor();
        //    descriptions.push(detections.descriptor);
        //    return new faceapi.LabeledFaceDescriptors(label.toString(), descriptions);
        //})
    //);
}

async function getLabels() {
    try {
        const res = await fetch('/recognize_user/sendID');
        const labels = await res.json();
        return labels;
    } catch (error) {
        console.log(error);
        return [];
    }
}

 async function getPhotoIds() {
    try {
        const res = await fetch('/recognize_user/getPhotoID');
        const idObj = await res.json();
        return idObj;
    } catch (err) {
        console.log(err);
        return [];
    }
 }

async function getUserInformation() {
    try {
        const response = await fetch('/recognize_user/sendInfo');
        const info = await response.json();
        return info;
    } catch (err) {
        console.log(err);
    }
}

async function faceRecognition() {
    const labels = await getLabels();
    const labeledFaceDescriptors = await getLabeledFaceDescriptions(labels);
    const faceMatcher = new faceapi.FaceMatcher(labeledFaceDescriptors);

    video.addEventListener("play", async () => {
        const canvas = faceapi.createCanvasFromMedia(video, { willReadFrequently: true }); 

        document.body.append(canvas);
        const videoWidth = video.videoWidth;
        const videoHeight = video.videoHeight;

        let displaySize = {width: video.width, height: video.height};

        if (window.innerWidth <= 700) {
            const scale = Math.min(window.innerWidth / videoWidth, window.innerHeight / videoHeight);
            displaySize = { width: video.videoWidth * scale, height: video.videoHeight * scale };
        }

        faceapi.matchDimensions(canvas, displaySize);
        
        const userInfo = await getUserInformation();

        setInterval(async () => {
            const detections = await faceapi
                .detectAllFaces(video)
                .withFaceLandmarks()
                .withFaceDescriptors();
            
            const resizedDetections = faceapi.resizeResults(detections, displaySize);

            canvas.getContext('2d').clearRect(0, 0, canvas.width, canvas.height);

            const results = resizedDetections.map((d) => {
                return faceMatcher.findBestMatch(d.descriptor);
            });

            results.forEach(async (result, i)=> {
                const box = resizedDetections[i].detection.box;
                const userLabel = parseInt(result.toString().split(" ")[0], 10);
                
                userInfo.forEach((obj) => {
                    if (obj.id === userLabel) {
                        const drawBox = new faceapi.draw.DrawBox(box, {label: `${obj.name} ${obj.domain}`});
                        drawBox.draw(canvas);
                        canvas.addEventListener('click', (event) => {
                            const x = event.offsetX;
                            const y = event.offsetY;

                            if ((x >= box.x && x <= (box.x + box.width)) && 
                                (y >= box.y) && y <= (box.y + box.height)) {
                                const userLabel = result.toString().split(" ")[0]; 
                                window.location.href = `/display_information/displayInformation.html?label=${userLabel}`;
                            }
                        });
                    }
                });
            })
        }, 100);
    });
}

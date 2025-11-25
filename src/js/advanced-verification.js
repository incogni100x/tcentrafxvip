let currentPhotoType = null;
let stream = null;

// Global functions for onclick handlers
window.openFilePicker = function(type) {
  const fileInput = document.getElementById(`${type}-file`);
  fileInput.click();
};

window.openCamera = function(type) {
  currentPhotoType = type;
  const modal = document.getElementById('camera-modal');
  modal.classList.add('active');
  startCamera();
};

window.removePhoto = function(type) {
  const fileInput = document.getElementById(`${type}-file`);
  const dataInput = document.getElementById(`${type}-data`);
  const preview = document.getElementById(`${type}-preview`);
  const placeholder = document.getElementById(`${type}-placeholder`);
  const actions = document.getElementById(`${type}-actions`);
  const uploadArea = document.getElementById(`${type}-upload-area`);

  fileInput.value = '';
  dataInput.value = '';
  preview.classList.add('hidden');
  preview.src = '';
  placeholder.classList.remove('hidden');
  actions.classList.add('hidden');
  uploadArea.classList.remove('has-image');
};

// File input change handlers
document.getElementById('selfie-file').addEventListener('change', (e) => handleFileSelect(e, 'selfie'));
document.getElementById('id-front-file').addEventListener('change', (e) => handleFileSelect(e, 'id-front'));
document.getElementById('id-back-file').addEventListener('change', (e) => handleFileSelect(e, 'id-back'));

function handleFileSelect(event, type) {
  const file = event.target.files[0];
  if (file) {
    const reader = new FileReader();
    reader.onload = (e) => {
      displayPhoto(e.target.result, type);
    };
    reader.readAsDataURL(file);
  }
}

function displayPhoto(dataUrl, type) {
  const preview = document.getElementById(`${type}-preview`);
  const placeholder = document.getElementById(`${type}-placeholder`);
  const actions = document.getElementById(`${type}-actions`);
  const dataInput = document.getElementById(`${type}-data`);
  const uploadArea = document.getElementById(`${type}-upload-area`);

  preview.src = dataUrl;
  preview.classList.remove('hidden');
  placeholder.classList.add('hidden');
  actions.classList.remove('hidden');
  uploadArea.classList.add('has-image');
  dataInput.value = dataUrl;
}

function startCamera() {
  navigator.mediaDevices.getUserMedia({ 
    video: { 
      facingMode: 'user',
      width: { ideal: 1280 },
      height: { ideal: 720 }
    } 
  })
  .then((mediaStream) => {
    stream = mediaStream;
    const video = document.getElementById('camera-video');
    video.srcObject = stream;
  })
  .catch((error) => {
    console.error('Error accessing camera:', error);
    alert('Unable to access camera. Please check your permissions or use the upload option instead.');
    closeCamera();
  });
}

function closeCamera() {
  if (stream) {
    stream.getTracks().forEach(track => track.stop());
    stream = null;
  }
  const modal = document.getElementById('camera-modal');
  modal.classList.remove('active');
  const video = document.getElementById('camera-video');
  video.srcObject = null;
  currentPhotoType = null;
}

function capturePhoto() {
  const video = document.getElementById('camera-video');
  const canvas = document.getElementById('camera-canvas');
  const context = canvas.getContext('2d');

  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  context.drawImage(video, 0, 0);

  const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
  displayPhoto(dataUrl, currentPhotoType);
  closeCamera();
}

// Camera modal controls
document.getElementById('capture-btn').addEventListener('click', capturePhoto);
document.getElementById('cancel-camera-btn').addEventListener('click', closeCamera);

// Form submission
document.getElementById('verification-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  
  const submitBtn = document.getElementById('submit-btn');
  const btnText = submitBtn.querySelector('.btn-text');
  const btnSpinner = submitBtn.querySelector('.btn-spinner');
  
  // Validate form
  const ssn = document.getElementById('ssn').value.trim();
  const emailReference = document.getElementById('email_reference').value.trim();
  const selfieData = document.getElementById('selfie-data').value;
  const idFrontData = document.getElementById('id-front-data').value;
  const idBackData = document.getElementById('id-back-data').value;

  if (!ssn) {
    alert('Please enter your SSN');
    return;
  }

  if (!selfieData) {
    alert('Please upload or take a selfie photo');
    return;
  }

  if (!idFrontData) {
    alert('Please upload or take a photo of your ID card front');
    return;
  }

  if (!idBackData) {
    alert('Please upload or take a photo of your ID card back');
    return;
  }

  // Show loading state
  submitBtn.disabled = true;
  btnText.textContent = 'Submitting...';
  btnSpinner.classList.remove('hidden');

  try {
    // Prepare form data
    const formData = {
      ssn: ssn,
      email_reference: emailReference,
      selfie: selfieData,
      id_front: idFrontData,
      id_back: idBackData
    };

    // TODO: Replace with your actual API endpoint
    const response = await fetch('/api/verification/submit', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(formData)
    });

    if (!response.ok) {
      throw new Error('Submission failed');
    }

    const result = await response.json();
    
    // Show success message
    alert('Verification submitted successfully! Your documents are under review.');
    
    // Redirect or show success message
    // window.location.href = '/dashboard';
    
  } catch (error) {
    console.error('Error submitting verification:', error);
    alert('Failed to submit verification. Please try again.');
  } finally {
    // Reset button state
    submitBtn.disabled = false;
    btnText.textContent = 'Submit Verification';
    btnSpinner.classList.add('hidden');
  }
});

// Close camera modal when clicking outside
document.getElementById('camera-modal').addEventListener('click', (e) => {
  if (e.target.id === 'camera-modal') {
    closeCamera();
  }
});


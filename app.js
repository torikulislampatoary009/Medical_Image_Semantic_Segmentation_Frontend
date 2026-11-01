"use strict";

const API_URL = (
    localStorage.getItem("NEUROSEG_API_URL") ||
    "https://medical-image-semantic-segmentation-vv5r.onrender.com"
).replace(/\/$/, "");

const statusElement = document.getElementById("apiStatus");
const messageElement = document.getElementById("message");
const sliceInputs = {
    previous: document.getElementById("previousInput"),
    current: document.getElementById("currentInput"),
    following: document.getElementById("followingInput"),
};

function setMessage(message, isError = false) {
    messageElement.textContent = message;
    messageElement.classList.toggle("error", isError);
}

async function checkApi() {
    try {
        const response = await fetch(`${API_URL}/health`);
        if (!response.ok) throw new Error("API health check failed");
        const data = await response.json();
        statusElement.textContent = data.model_loaded
            ? "API connected · model loaded"
            : "API connected · model unavailable";
        statusElement.classList.toggle("online", Boolean(data.model_loaded));
    } catch (error) {
        statusElement.textContent = "API not connected";
        statusElement.classList.remove("online");
    }
}

Object.entries(sliceInputs).forEach(([key, input]) => {
    input.addEventListener("change", () => {
        const file = input.files[0];
        if (!file) return;

        const nameElement = document.getElementById(`${key}Name`);
        nameElement.textContent = file.name;

        // Show source dimensions for transparency. Different dimensions are
        // allowed; the backend independently resizes each slice to 256x256.
        if (window.createImageBitmap) {
            createImageBitmap(file)
                .then((bitmap) => {
                    nameElement.textContent =
                        `${file.name} · ${bitmap.width} × ${bitmap.height}px`;
                    bitmap.close();
                })
                .catch(() => {
                    nameElement.textContent = `${file.name} · dimensions unavailable`;
                });
        }

        if (key === "current") {
            const preview = document.getElementById("originalPreview");
            preview.src = URL.createObjectURL(file);
            preview.style.display = "block";
            document.getElementById("originalEmpty").style.display = "none";
        }
    });
});

document.getElementById("threshold").addEventListener("input", (event) => {
    document.getElementById("thresholdValue").textContent =
        Number(event.target.value).toFixed(2);
});

document.getElementById("runBtn").addEventListener("click", async () => {
    const files = Object.fromEntries(
        Object.entries(sliceInputs).map(([key, input]) => [key, input.files[0]])
    );

    if (Object.values(files).some((file) => !file)) {
        setMessage("Please select all three adjacent FLAIR slices.", true);
        return;
    }

    const button = document.getElementById("runBtn");
    const formData = new FormData();
    formData.append("previous", files.previous);
    formData.append("current", files.current);
    formData.append("following", files.following);
    formData.append("threshold", document.getElementById("threshold").value);

    button.disabled = true;
    button.textContent = "Processing…";
    setMessage("Preparing the three slices independently at 256 × 256, then running pretrained U-Net inference. The first request may take longer while Render wakes up.");

    try {
        const response = await fetch(`${API_URL}/api/v1/segment`, {
            method: "POST",
            body: formData,
        });
        const result = await response.json();
        if (!response.ok) {
            throw new Error(result.detail || "Segmentation request failed.");
        }

        const maskPreview = document.getElementById("maskPreview");
        maskPreview.src = `data:image/png;base64,${result.mask_png_base64}`;
        maskPreview.style.display = "block";
        document.getElementById("maskEmpty").style.display = "none";
        setMessage(`${result.message} ${result.warning || ""}`);
    } catch (error) {
        setMessage(`API error: ${error.message}`, true);
    } finally {
        button.disabled = false;
        button.textContent = "Run segmentation";
    }
});

checkApi();

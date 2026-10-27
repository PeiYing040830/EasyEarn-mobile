import { createApplication } from './supabase-data.js';

export function showApplyModal({ jobId, userId, triggerBtn }) {
    const existing = document.getElementById('apply-resume-modal');
    if (existing) return;

    const modal = document.createElement('div');
    modal.id = 'apply-resume-modal';
    modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.5);z-index:9999;display:flex;align-items:center;justify-content:center;padding:16px;';
    modal.innerHTML = `
      <div style="background:#fff;border-radius:16px;padding:28px;max-width:480px;width:100%;box-shadow:0 20px 60px rgba(0,0,0,0.2);">
        <h3 style="margin:0 0 6px;font-size:1.15rem;">Apply for this job</h3>
        <p style="color:#64748b;font-size:.9rem;margin:0 0 20px;">Attach your resume (optional). Supported: PDF, DOC, DOCX (max 5MB).</p>
        <label style="display:block;font-weight:600;font-size:.9rem;margin-bottom:8px;">Resume / CV</label>
        <div id="apply-drop-zone" style="border:2px dashed #5eead4;border-radius:10px;padding:24px;text-align:center;cursor:pointer;background:#f0fdfa;transition:background .2s;">
          <p style="margin:0;color:#16a34a;font-size:.9rem;">📄 Click to upload or drag & drop</p>
          <p id="apply-file-name" style="margin:6px 0 0;color:#94a3b8;font-size:.8rem;">No file selected</p>
          <input id="apply-file-input" type="file" accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document" style="display:none;">
        </div>
        <div style="display:flex;gap:10px;margin-top:20px;">
          <button id="apply-cancel-btn" type="button" style="flex:1;padding:10px;border:1.5px solid #e2e8f0;border-radius:8px;background:#fff;cursor:pointer;font-size:.95rem;">Cancel</button>
          <button id="apply-submit-btn" type="button" style="flex:2;padding:10px;border:none;border-radius:8px;background:#16a34a;color:#fff;cursor:pointer;font-weight:600;font-size:.95rem;">Submit Application</button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    let resumeBase64 = null;
    let fileVersion = 0;
    let submitting = false;

    const dropZone = document.getElementById('apply-drop-zone');
    const fileInput = document.getElementById('apply-file-input');
    const fileNameEl = document.getElementById('apply-file-name');
    const submitBtn = document.getElementById('apply-submit-btn');
    const cancelBtn = document.getElementById('apply-cancel-btn');

    // Handles the file action triggered by the user.
    function handleFile(file) {
      if (!file || submitting) return;
      const version = ++fileVersion;
      resumeBase64 = null;
      submitBtn.disabled = true;
      fileNameEl.textContent = 'Reading file...';
      fileNameEl.style.color = '#64748b';
      if (!/\.(pdf|doc|docx)$/i.test(file.name) || file.size > 5 * 1024 * 1024 || file.size === 0) {
        fileNameEl.textContent = 'Choose a non-empty PDF, DOC or DOCX file, up to 5MB.';
        fileNameEl.style.color = '#dc2626';
        fileInput.value = '';
        return;
      }
      const reader = new FileReader();
      reader.onload = (e) => {
        if (version !== fileVersion) return;
        resumeBase64 = e.target.result;
        submitBtn.disabled = false;
        fileNameEl.textContent = `✅ ${file.name}`;
        fileNameEl.style.color = '#16a34a';
      };
      reader.onerror = () => {
        if (version !== fileVersion) return;
        fileNameEl.textContent = 'Unable to read this file. Please select it again.';
        fileNameEl.style.color = '#dc2626';
        fileInput.value = '';
      };
      reader.readAsDataURL(file);
    }

    // Connects this element event to the handler that should run next.
    dropZone.addEventListener('click', () => fileInput.click());
    // Connects this element event to the handler that should run next.
    fileInput.addEventListener('change', () => handleFile(fileInput.files[0]));
    // Connects this element event to the handler that should run next.
    dropZone.addEventListener('dragover', (e) => { e.preventDefault(); dropZone.style.background = '#ede9fe'; });
    // Connects this element event to the handler that should run next.
    dropZone.addEventListener('dragleave', () => { dropZone.style.background = '#f0fdfa'; });
    // Connects this element event to the handler that should run next.
    dropZone.addEventListener('drop', (e) => { e.preventDefault(); dropZone.style.background = '#f0fdfa'; handleFile(e.dataTransfer.files[0]); });

    // Connects this element event to the handler that should run next.
    cancelBtn.addEventListener('click', () => { if (!submitting) modal.remove(); });
    // Connects this element event to the handler that should run next.
    modal.addEventListener('click', (e) => { if (e.target === modal && !submitting) modal.remove(); });

    // Connects this element event to the handler that should run next.
    submitBtn.addEventListener('click', async () => {
      if (submitBtn.disabled || submitting) return;
      submitting = true;
      submitBtn.disabled = true;
      cancelBtn.disabled = true;
      fileInput.disabled = true;
      submitBtn.textContent = 'Submitting…';

      try {
        await createApplication({
          job_id: jobId,
          user_id: userId,
          status: 'pending',
          resume_url: resumeBase64 || null
        });

        modal.remove();
        window.location.href = 'applications.html';
      } catch (error) {
        console.error('Apply failed:', error);
        const code = String(error?.code || '');
        const message = String(error?.message || '').toLowerCase();
        if (code === '23505' || message.includes('duplicate')) {
          modal.remove();
          triggerBtn.textContent = 'Applied';
          triggerBtn.disabled = true;
        } else if (message.includes('no openings available')) {
          modal.remove();
          triggerBtn.textContent = 'Full';
          triggerBtn.disabled = true;
          alert('This job has no openings left.');
        } else {
          submitting = false;
          cancelBtn.disabled = false;
          fileInput.disabled = false;
          submitBtn.disabled = false;
          submitBtn.textContent = 'Submit Application';
          alert('Unable to submit application. Please try again.');
        }
      }
    });
  }

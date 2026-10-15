import Swal from "sweetalert2";

export const swalAlert = (title, text, icon = "info") => {
  return Swal.fire({
    title,
    text,
    icon,
    confirmButtonColor: "#0B2149",
    customClass: {
      popup: "rounded-2xl shadow-xl border border-slate-200 font-sans",
      confirmButton: "px-5 py-2.5 rounded-lg text-sm font-semibold"
    }
  });
};

export const swalConfirm = async ({
  title,
  text,
  icon = "question",
  confirmButtonText = "Ya, Lanjutkan",
  cancelButtonText = "Batal",
  confirmButtonColor = "#0B2149"
}) => {
  const res = await Swal.fire({
    title,
    text,
    icon,
    showCancelButton: true,
    confirmButtonColor,
    cancelButtonColor: "#94a3b8",
    confirmButtonText,
    cancelButtonText,
    customClass: {
      popup: "rounded-2xl shadow-xl border border-slate-200 font-sans",
      confirmButton: "px-5 py-2.5 rounded-lg text-sm font-semibold",
      cancelButton: "px-5 py-2.5 rounded-lg text-sm font-semibold"
    }
  });
  return res.isConfirmed;
};

export const swalPromptReason = async ({
  title,
  text = "",
  categories = [],
  confirmButtonText = "Konfirmasi",
  isReject = false
}) => {
  const optionsHtml = (categories || [])
    .map((c) => `<option value="${c}">${c}</option>`)
    .join("");

  const categorySelectHtml =
    categories && categories.length > 0
      ? `
    <div style="text-align: left; margin-bottom: 14px;">
      <label style="font-size: 12px; font-weight: 600; color: #334155; display: block; margin-bottom: 5px;">Kategori Masalah / Kendala</label>
      <select id="swal-category" style="width: 100%; padding: 8px 12px; font-size: 13px; border: 1px solid #cbd5e1; border-radius: 8px; background: white; outline: none;">
        ${optionsHtml}
      </select>
    </div>
  `
      : "";

  const { value: formValues } = await Swal.fire({
    title,
    text,
    icon: isReject ? "error" : "warning",
    html: `
      ${categorySelectHtml}
      <div style="text-align: left;">
        <label style="font-size: 12px; font-weight: 600; color: #334155; display: block; margin-bottom: 5px;">Alasan Lengkap <span style="color: #e11d48;">* Wajib Diisi</span></label>
        <textarea id="swal-reason" rows="3" placeholder="Tuliskan keterangan detail agar tercatat di audit trail..." style="width: 100%; padding: 8px 12px; font-size: 13px; border: 1px solid #cbd5e1; border-radius: 8px; box-sizing: border-box; outline: none;"></textarea>
      </div>
    `,
    showCancelButton: true,
    confirmButtonText,
    cancelButtonText: "Batal",
    confirmButtonColor: isReject ? "#e11d48" : "#d97706",
    cancelButtonColor: "#94a3b8",
    focusConfirm: false,
    customClass: {
      popup: "rounded-2xl shadow-xl border border-slate-200 font-sans",
      confirmButton: "px-5 py-2.5 rounded-lg text-sm font-semibold",
      cancelButton: "px-5 py-2.5 rounded-lg text-sm font-semibold"
    },
    preConfirm: () => {
      const reason = document.getElementById("swal-reason")?.value?.trim();
      const category = document.getElementById("swal-category")?.value || "";
      if (!reason) {
        Swal.showValidationMessage("Alasan wajib diisi!");
        return false;
      }
      return { reason, category };
    }
  });

  return formValues;
};

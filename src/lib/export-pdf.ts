import jsPDF from "jspdf";
import html2canvas from "html2canvas";

export async function exportElementToPdf(el: HTMLElement, fileName: string) {
  const canvas = await html2canvas(el, {
    backgroundColor: getComputedStyle(document.body).backgroundColor || "#ffffff",
    scale: 2,
    useCORS: true,
    logging: false,
  });
  const imgData = canvas.toDataURL("image/png");
  const pdf = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
  const pageW = pdf.internal.pageSize.getWidth();
  const pageH = pdf.internal.pageSize.getHeight();
  const ratio = canvas.width / canvas.height;
  let imgW = pageW - 40;
  let imgH = imgW / ratio;
  if (imgH > pageH - 40) {
    imgH = pageH - 40;
    imgW = imgH * ratio;
  }
  const x = (pageW - imgW) / 2;
  const y = (pageH - imgH) / 2;
  pdf.addImage(imgData, "PNG", x, y, imgW, imgH);
  pdf.save(fileName);
}
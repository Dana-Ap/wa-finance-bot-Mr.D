// =========================================================
//      🤖 BOT ASISTEN KEUANGAN - VERSION 6.9
//      (PORTFOLIO EDITION - CLEAN DATA)
//      MOTTO: "FORTIS FORTUNA ADIUVAT" 🛡️🔥
// =========================================================

// CONFIGURATION (PLACEHOLDER FOR GITHUB)
var SHEET_URL = "https://docs.google.com/spreadsheets/d/YOUR_SPREADSHEET_ID/edit";
var SHEET_NAME = "Transaksi";
var FONNTE_TOKEN = "YOUR_FONNTE_TOKEN_HERE";

// Whitelist User (Masked for Privacy)
var WHITELIST = ["6281xxxx", "6280xxxx"]; 

var TOLERANSI_KOMPAK = 200000;
var BATAS_TANYA_BESAR = 100000;
var BATAS_TANYA_MISTERI = 15000;

function doPost(e) {
  try {
    if (!e || !e.postData) return ContentService.createTextOutput("No Data");
    var data = JSON.parse(e.postData.contents);
    var pesan = (data.message || data.text || "").trim();
    var sender = data.sender || data.phone || "";

    var cache = CacheService.getScriptCache();
    var msgId = sender + pesan.replace(/\s/g, "");
    if (cache.get(msgId)) return ContentService.createTextOutput("Duplicate");
    cache.put(msgId, "processed", 30);

    if (WHITELIST.indexOf(sender) === -1)
      return ContentService.createTextOutput("OK");
    if (!pesan || data.status) return ContentService.createTextOutput("OK");

    var panggilan = sender === WHITELIST[0] ? "Admin 1" : "Admin 2";
    var lowerPesan = pesan.toLowerCase();
    var reply = "";

    // 🚀 JALUR TURBO: Konfirmasi Interaktif
    if (pesan.length === 1 && !isNaN(parseInt(pesan))) {
      var statusUser = getBotStatus(sender);
      if (statusUser.status !== "NORMAL") {
        reply = prosesJawabanInteraktif(sender, pesan, statusUser, panggilan);
      } else {
        reply = "⚠️ Tidak ada transaksi yang butuh konfirmasi!";
      }
    } else if (lowerPesan.startsWith("masuk"))
      reply = catatTransaksi(pesan, "Pemasukan", sender, panggilan);
    else if (lowerPesan.startsWith("keluar"))
      reply = catatTransaksi(pesan, "Pengeluaran", sender, panggilan);
    else if (lowerPesan === "laporan bersama") reply = cekLaporanBersama();
    else if (lowerPesan.startsWith("laporan")) {
      var param = lowerPesan.replace("laporan", "").trim();
      reply = cekLaporanHarianDetail(param, panggilan, sender);
    } else if (lowerPesan === "link" || lowerPesan === "file")
      reply = "📂 *File Keuangan:* \n" + SHEET_URL;
    else if (lowerPesan === "batal" || lowerPesan === "undo")
      reply = batalkanTransaksi(panggilan, sender);
    else if (lowerPesan === "menu" || lowerPesan === "help") {
      reply =
        "🤖 *BOT ASISTEN KEUANGAN*\n----------------------------------\n" +
        "🟢 *CATAT*: `masuk 5jt Gaji`\n🔴 *CATAT*: `keluar 15rb Jajan Bakso`\n\n" +
        "📊 *LAPORAN*: `laporan` \n🌐 *GABUNGAN*: `laporan bersama` \n🔗 *LINK*: `link` \n❌ *BATAL*: `batal` \n\n" +
        "⚠️ *Note:* Gunakan keyword (Makan/Jajan/Kebutuhan/Self Reward/Lain-lain) di awal.";
    } else {
      reply = "🤖 *Hormat saya, " + panggilan + "!* \nKetik *menu* untuk arahan! 🚀";
    }

    if (reply) kirimPesanFonnte(sender, reply);
  } catch (err) {
    console.error("Error: " + err.message);
  }
  return ContentService.createTextOutput("OK");
}

// =========================================================
//      📊 FITUR LAPORAN & TRANSAKSI
// =========================================================

function getUserSummaryOptimized(sheet, sender, mode) {
  try {
    var data = sheet.getDataRange().getValues();
    var now = new Date(), m = 0, k = 0;
    for (var i = 1; i < data.length; i++) {
      var trDate = new Date(data[i][0]);
      if (data[i][4] == sender) {
        var isMonth = trDate.getMonth() == now.getMonth() && trDate.getFullYear() == now.getFullYear();
        if (mode === "TOTAL" || isMonth) {
          var h = Number(data[i][3]);
          if (String(data[i][1]).toLowerCase().includes("masuk")) m += h;
          else k += h;
        }
      }
    }
    return { masuk: m, keluar: k, sisa: m - k };
  } catch (e) {
    return { masuk: 0, keluar: 0, sisa: 0 };
  }
}

function cekLaporanBersama() {
  try {
    var sheet = SpreadsheetApp.openByUrl(SHEET_URL).getSheetByName(SHEET_NAME);
    var pB = getUserSummaryOptimized(sheet, WHITELIST[0], "MONTH");
    var iB = getUserSummaryOptimized(sheet, WHITELIST[1], "MONTH");
    var blnIndo = ["JANUARI","FEBRUARI","MARET","APRIL","MEI","JUNI","JULI","AGUSTUS","SEPTEMBER","OKTOBER","NOVEMBER","DESEMBER"];
    var namaBln = blnIndo[new Date().getMonth()];

    var res = "🌐 *LAPORAN GABUNGAN - " + namaBln + "* 📈\n----------------------------------\n";
    res += "🤵 *USER 1*\n🟢 Masuk: Rp " + pB.masuk.toLocaleString("id-ID") + "\n🔴 Keluar: Rp " + pB.keluar.toLocaleString("id-ID") + "\n\n";
    res += "👰 *USER 2*\n🟢 Masuk: Rp " + iB.masuk.toLocaleString("id-ID") + "\n🔴 Keluar: Rp " + iB.keluar.toLocaleString("id-ID") + "\n----------------------------------\n";

    var selisih = Math.abs(pB.keluar - iB.keluar);
    if (selisih <= TOLERANSI_KOMPAK) res += "🌟 *APRESIASI:* Kekompakan finansial yang luar biasa bulan ini! ✨";
    else res += "🤝 *PENGINGAT:* Tetap jaga koordinasi pengeluaran agar rencana finansial tetap terjaga.";
    return res;
  } catch (e) { return "Error: " + e.message; }
}

function cekLaporanHarianDetail(param, panggilan, sender) {
  try {
    var sheet = SpreadsheetApp.openByUrl(SHEET_URL).getSheetByName(SHEET_NAME);
    var data = sheet.getDataRange().getDisplayValues();
    var tgl = new Date().getDate();
    if (param && !isNaN(parseInt(param))) tgl = parseInt(param);
    var listM = [], listK = [], totM = 0, totK = 0;

    for (var i = 1; i < data.length; i++) {
      var d = String(data[i][0]).split(/[\/\-\s]/);
      if (d.length >= 3 && parseInt(d[0]) == tgl && data[i][4] == sender) {
        var h = Number(String(data[i][3]).replace(/[^0-9]/g, ""));
        if (String(data[i][1]).toLowerCase().includes("masuk")) {
          listM.push("- " + data[i][2] + " (Rp " + h.toLocaleString("id-ID") + ")");
          totM += h;
        } else {
          listK.push("- " + data[i][2] + " (Rp " + h.toLocaleString("id-ID") + ")");
          totK += h;
        }
      }
    }
    var totalSaldoAll = getUserSummaryOptimized(sheet, sender, "TOTAL").sisa;
    return "📊 *LAPORAN TANGGAL " + tgl + "*\n\n🟢 *PEMASUKAN:*\n" + (listM.length ? listM.join("\n") : "_Nihil_") + "\n\n🔴 *PENGELUARAN:*\n" + (listK.length ? listK.join("\n") : "_Nihil_") + "\n\n💳 *TOTAL SALDO: Rp " + totalSaldoAll.toLocaleString("id-ID") + "*";
  } catch (e) { return "Error: " + e.message; }
}

function catatTransaksi(pesan, tipe, sender, panggilan) {
  try {
    var splitPesan = pesan.split(" ");
    if (splitPesan.length < 2) return "⚠️ Format salah. Contoh: *" + (tipe == "Pemasukan" ? "masuk" : "keluar") + " 50k Keterangan*";
    var jumlah = parseNominal(splitPesan[1]), ket = splitPesan.slice(2).join(" ") || "-";
    if (isNaN(jumlah) || jumlah === 0) return "❌ Angka tidak valid.";

    var sheet = SpreadsheetApp.openByUrl(SHEET_URL).getSheetByName(SHEET_NAME);

    if (tipe === "Pengeluaran") {
      var kat = deteksiKategoriPintar(ket);
      if (jumlah >= BATAS_TANYA_BESAR || (jumlah >= BATAS_TANYA_MISTERI && kat === "MISTERI")) {
        setBotStatus(sender, "MENUNGGU_KATEGORI", JSON.stringify({tipe: tipe, ket: ket, jumlah: jumlah, sender: sender}));
        return "⚠️ *KONFIRMASI TRANSAKSI*\nInput: *" + ket + " (Rp " + jumlah.toLocaleString("id-ID") + ")*\n\nPilih Kategori:\n1. Makan\n2. Jajan\n3. Kebutuhan Pokok\n4. Self Reward\n5. Lain-lain";
      }
      if (kat === "MISTERI") kat = "Lain-lain";
      ket = ket + " [" + kat + "]";
    }

    sheet.appendRow([new Date(), tipe, ket, jumlah, sender]);
    autoFormatRow(sheet);
    var totalSaldo = getUserSummaryOptimized(sheet, sender, "TOTAL").sisa;
    return "✅ *Berhasil dicatat!*\n📝 " + ket + "\n💰 Rp " + jumlah.toLocaleString("id-ID") + "\n💳 *Saldo: Rp " + totalSaldo.toLocaleString("id-ID") + "*";
  } catch (err) { return "Error: " + err.message; }
}

function prosesJawabanInteraktif(noWA, jawaban, statusObj, panggilan) {
  try {
    var dataJson = JSON.parse(statusObj.dataPending);
    var daftarKat = ["Makan 🍚", "Jajan 🍦", "Kebutuhan Pokok 🏠", "Self Reward 💄", "Lain-lain ❓"];
    var index = parseInt(jawaban) - 1;
    if (index < 0 || index > 4) return "❌ Pilih 1-5!";
    var kat = daftarKat[index], sheet = SpreadsheetApp.openByUrl(SHEET_URL).getSheetByName(SHEET_NAME);

    var ketBaru = dataJson.ket + " [" + kat + "]";
    sheet.appendRow([new Date(), dataJson.tipe, ketBaru, dataJson.jumlah, noWA]);
    autoFormatRow(sheet);
    setBotStatus(noWA, "NORMAL", "");

    var totalSaldo = getUserSummaryOptimized(sheet, noWA, "TOTAL").sisa;
    return "✅ *Konfirmasi Berhasil!*\n📝 " + ketBaru + "\n💰 Rp " + dataJson.jumlah.toLocaleString("id-ID") + "\n💳 *Saldo: Rp " + totalSaldo.toLocaleString("id-ID") + "*";
  } catch (e) { return "Error: " + e.message; }
}

// --- ⚙️ UTILITY FUNCTIONS ---

function autoFormatRow(sheet) {
  var lastRow = sheet.getLastRow();
  if (lastRow > 2) {
    var templateRange = sheet.getRange(2, 1, 1, 5);
    var targetRange = sheet.getRange(lastRow, 1, 1, 5);
    templateRange.copyTo(targetRange, SpreadsheetApp.CopyPasteType.PASTE_FORMAT, false);
  }
}

function parseNominal(t) {
  var s = String(t).toLowerCase().replace("rp", "").replace(/\s/g, "");
  var p = 1;
  if (s.match(/m/)) p = 1e9;
  else if (s.match(/jt/)) p = 1e6;
  else if (s.match(/k|rb/)) p = 1e3;
  s = s.replace(/m|jt|k|rb|ribu|juta|miliar/g, "").replace(",", ".");
  return Math.round(parseFloat(s) * p);
}

function deteksiKategoriPintar(k) {
  var t = k.toLowerCase();
  if (t.includes("makan") || t.includes("nasi")) return "Makan 🍚";
  if (t.includes("jajan") || t.includes("kopi")) return "Jajan 🍦";
  if (t.includes("kos") || t.includes("listrik") || t.includes("bensin")) return "Kebutuhan Pokok 🏠";
  if (t.includes("reward") || t.includes("game")) return "Self Reward 💄";
  return "MISTERI";
}

function kirimPesanFonnte(nomor, pesan) {
  try {
    UrlFetchApp.fetch("https://api.fonnte.com/send", {
      method: "post",
      headers: { Authorization: FONNTE_TOKEN },
      payload: { target: nomor, message: pesan },
      muteHttpExceptions: true,
    });
  } catch (e) {}
}

function getBotStatus(noWA) {
  var s = SpreadsheetApp.openByUrl(SHEET_URL).getSheetByName("Status_Bot");
  if (!s) return { status: "NORMAL", dataPending: "" };
  var v = s.getDataRange().getValues();
  for (var i = 1; i < v.length; i++) {
    if (v[i][0] == noWA) return { status: v[i][1], dataPending: v[i][2] };
  }
  return { status: "NORMAL", dataPending: "" };
}

function setBotStatus(noWA, status, data) {
  var ss = SpreadsheetApp.openByUrl(SHEET_URL);
  var s = ss.getSheetByName("Status_Bot") || ss.insertSheet("Status_Bot");
  var v = s.getDataRange().getValues();
  for (var i = 1; i < v.length; i++) {
    if (v[i][0] == noWA) {
      s.getRange(i + 1, 2, 1, 2).setValues([[status, data]]);
      return;
    }
  }
  s.appendRow([noWA, status, data]);
}

function batalkanTransaksi(p, s) {
  var sh = SpreadsheetApp.openByUrl(SHEET_URL).getSheetByName(SHEET_NAME);
  var d = sh.getDataRange().getValues();
  for (var i = d.length - 1; i >= 1; i--) {
    if (d[i][4] == s) {
      sh.deleteRow(i + 1);
      return "♻️ *Dibatalkan:* " + d[i][2];
    }
  }
  return "⚠️ Data kosong!";
}

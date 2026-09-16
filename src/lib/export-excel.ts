import { writeSave } from "@/lib/save-file";

export type ExcelExportRow = {
  iso: string;
  price: number;
  fair: number;
  floor: number;
  top: number;
};

async function loadJSZip() {
  const g = globalThis as unknown as { setImmediate?: (...args: unknown[]) => unknown };
  if (typeof g.setImmediate !== "function") {
    g.setImmediate = (fn: (...args: unknown[]) => void, ...args: unknown[]) =>
      globalThis.setTimeout(fn, 0, ...args);
  }
  const mod = await import("jszip");
  return mod.default;
}

function esc(value: string): string {
  return value
    .replace(/&/g, "&" + "amp;")
    .replace(/</g, "&" + "lt;")
    .replace(/>/g, "&" + "gt;")
    .replace(/"/g, "&" + "quot;");
}

function num(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return "";
  return String(Math.round(value * 1e8) / 1e8);
}

function cellInline(ref: string, text: string, style = 1): string {
  return `<c r="${ref}" t="inlineStr" s="${style}"><is><t>${esc(text)}</t></is></c>`;
}

function cellNum(ref: string, value: number): string {
  const v = num(value);
  if (!v) return `<c r="${ref}" s="2"/>`;
  return `<c r="${ref}" s="2"><v>${v}</v></c>`;
}

function series(nameRef: string, catRef: string, valRef: string, idx: number, rgb: string): string {
  return `<c:ser>
      <c:idx val="${idx}"/>
      <c:order val="${idx}"/>
      <c:tx><c:strRef><c:f>${nameRef}</c:f></c:strRef></c:tx>
      <c:spPr><a:ln w="20000"><a:solidFill><a:srgbClr val="${rgb}"/></a:solidFill></a:ln></c:spPr>
      <c:marker><c:symbol val="none"/></c:marker>
      <c:cat><c:strRef><c:f>${catRef}</c:f></c:strRef></c:cat>
      <c:val><c:numRef><c:f>${valRef}</c:f></c:numRef></c:val>
    </c:ser>`;
}

function chartXml(lastRow: number, title: string): string {
  const cats = `OrangeLaw!$A$2:$A$${lastRow}`;
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<c:chartSpace xmlns:c="http://schemas.openxmlformats.org/drawingml/2006/chart" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <c:chart>
    <c:title>
      <c:tx><c:rich><a:bodyPr/><a:lstStyle/><a:p><a:pPr><a:defRPr sz="1100"/></a:pPr><a:r><a:rPr lang="en-US" sz="1100"/><a:t>${esc(title)}</a:t></a:r></a:p></c:rich></c:tx>
      <c:overlay val="0"/>
    </c:title>
    <c:plotArea>
      <c:layout/>
      <c:lineChart>
        <c:grouping val="standard"/>
        <c:varyColors val="0"/>
        ${series("OrangeLaw!$B$1", cats, `OrangeLaw!$B$2:$B$${lastRow}`, 0, "FF5A12")}
        ${series("OrangeLaw!$C$1", cats, `OrangeLaw!$C$2:$C$${lastRow}`, 1, "F4EAD8")}
        ${series("OrangeLaw!$D$1", cats, `OrangeLaw!$D$2:$D$${lastRow}`, 2, "3EE8FF")}
        ${series("OrangeLaw!$E$1", cats, `OrangeLaw!$E$2:$E$${lastRow}`, 3, "FF4B6A")}
        <c:axId val="1"/>
        <c:axId val="2"/>
      </c:lineChart>
      <c:catAx>
        <c:axId val="1"/>
        <c:scaling><c:orientation val="minMax"/></c:scaling>
        <c:delete val="0"/>
        <c:axPos val="b"/>
        <c:tickLblPos val="nextTo"/>
        <c:crossAx val="2"/>
      </c:catAx>
      <c:valAx>
        <c:axId val="2"/>
        <c:scaling><c:logBase val="10"/><c:orientation val="minMax"/></c:scaling>
        <c:delete val="0"/>
        <c:axPos val="l"/>
        <c:majorGridlines/>
        <c:numFmt formatCode="General" sourceLinked="1"/>
        <c:tickLblPos val="nextTo"/>
        <c:crossAx val="1"/>
      </c:valAx>
    </c:plotArea>
    <c:legend><c:legendPos val="b"/><c:overlay val="0"/></c:legend>
    <c:plotVisOnly val="1"/>
  </c:chart>
</c:chartSpace>`;
}

function drawingXml(): string {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<xdr:wsDr xmlns:xdr="http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:c="http://schemas.openxmlformats.org/drawingml/2006/chart">
  <xdr:twoCellAnchor>
    <xdr:from><xdr:col>6</xdr:col><xdr:colOff>0</xdr:colOff><xdr:row>0</xdr:row><xdr:rowOff>0</xdr:rowOff></xdr:from>
    <xdr:to><xdr:col>18</xdr:col><xdr:colOff>0</xdr:colOff><xdr:row>20</xdr:row><xdr:rowOff>0</xdr:rowOff></xdr:to>
    <xdr:pic>
      <xdr:nvPicPr>
        <xdr:cNvPr id="2" name="Live chart"/>
        <xdr:cNvPicPr><a:picLocks noChangeAspect="1"/></xdr:cNvPicPr>
      </xdr:nvPicPr>
      <xdr:blipFill>
        <a:blip r:embed="rId1"/>
        <a:stretch><a:fillRect/></a:stretch>
      </xdr:blipFill>
      <xdr:spPr><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></xdr:spPr>
    </xdr:pic>
    <xdr:clientData/>
  </xdr:twoCellAnchor>
  <xdr:twoCellAnchor>
    <xdr:from><xdr:col>6</xdr:col><xdr:colOff>0</xdr:colOff><xdr:row>21</xdr:row><xdr:rowOff>0</xdr:rowOff></xdr:from>
    <xdr:to><xdr:col>18</xdr:col><xdr:colOff>0</xdr:colOff><xdr:row>42</xdr:row><xdr:rowOff>0</xdr:rowOff></xdr:to>
    <xdr:graphicFrame>
      <xdr:nvGraphicFramePr>
        <xdr:cNvPr id="3" name="Power law"/>
        <xdr:cNvGraphicFramePr><a:graphicFrameLocks noGrp="1"/></xdr:cNvGraphicFramePr>
      </xdr:nvGraphicFramePr>
      <xdr:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/></xdr:xfrm>
      <a:graphic>
        <a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/chart">
          <c:chart r:id="rId2"/>
        </a:graphicData>
      </a:graphic>
    </xdr:graphicFrame>
    <xdr:clientData/>
  </xdr:twoCellAnchor>
</xdr:wsDr>`;
}

function sheetXml(rows: ExcelExportRow[], unitLabel: string): string {
  const last = rows.length + 1;
  const body: string[] = [
    `<row r="1" s="1">`,
    cellInline("A1", "Date"),
    cellInline("B1", unitLabel),
    cellInline("C1", "Fair"),
    cellInline("D1", "Floor"),
    cellInline("E1", "Top"),
    `</row>`,
  ];
  rows.forEach((row, i) => {
    const r = i + 2;
    body.push(
      `<row r="${r}">`,
      cellInline(`A${r}`, row.iso, 0),
      cellNum(`B${r}`, row.price),
      cellNum(`C${r}`, row.fair),
      cellNum(`D${r}`, row.floor),
      cellNum(`E${r}`, row.top),
      `</row>`,
    );
  });
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheetPr><pageSetUpPr fitToPage="0"/></sheetPr>
  <dimension ref="A1:R${Math.max(last, 42)}"/>
  <sheetViews>
    <sheetView tabSelected="1" workbookViewId="0">
      <pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/>
    </sheetView>
  </sheetViews>
  <sheetFormatPr defaultRowHeight="15"/>
  <cols>
    <col min="1" max="1" width="14" customWidth="1"/>
    <col min="2" max="5" width="16" customWidth="1"/>
    <col min="7" max="18" width="12" customWidth="1"/>
  </cols>
  <sheetData>
    ${body.join("")}
  </sheetData>
  <drawing r:id="rId1"/>
</worksheet>`;
}

export async function downloadChartExcel(opts: {
  rows: ExcelExportRow[];
  unitLabel: string;
  jpeg: Uint8Array;
  filename: string;
  title: string;
  handle?: FileSystemFileHandle | null;
}): Promise<void> {
  if (opts.rows.length === 0) throw new Error("no rows");
  const lastRow = opts.rows.length + 1;
  const JSZip = await loadJSZip();
  const zip = new JSZip();
  zip.file(
    "[Content_Types].xml",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Default Extension="jpeg" ContentType="image/jpeg"/>
  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
  <Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
  <Override PartName="/xl/drawings/drawing1.xml" ContentType="application/vnd.openxmlformats-officedocument.drawing+xml"/>
  <Override PartName="/xl/charts/chart1.xml" ContentType="application/vnd.openxmlformats-officedocument.drawingml.chart+xml"/>
  <Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
</Types>`,
  );
  zip.file(
    "_rels/.rels",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`,
  );
  zip.file(
    "xl/workbook.xml",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheets>
    <sheet name="OrangeLaw" sheetId="1" r:id="rId1"/>
  </sheets>
</workbook>`,
  );
  zip.file(
    "xl/_rels/workbook.xml.rels",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`,
  );
  zip.file(
    "xl/styles.xml",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <numFmts count="1"><numFmt numFmtId="164" formatCode="0.########"/></numFmts>
  <fonts count="2">
    <font><sz val="11"/><color theme="1"/><name val="Calibri"/><family val="2"/></font>
    <font><b/><sz val="11"/><color theme="1"/><name val="Calibri"/><family val="2"/></font>
  </fonts>
  <fills count="2">
    <fill><patternFill patternType="none"/></fill>
    <fill><patternFill patternType="gray125"/></fill>
  </fills>
  <borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>
  <cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
  <cellXfs count="3">
    <xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
    <xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/>
    <xf numFmtId="164" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>
  </cellXfs>
</styleSheet>`,
  );
  zip.file("xl/worksheets/sheet1.xml", sheetXml(opts.rows, opts.unitLabel));
  zip.file(
    "xl/worksheets/_rels/sheet1.xml.rels",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/drawing" Target="../drawings/drawing1.xml"/>
</Relationships>`,
  );
  zip.file("xl/drawings/drawing1.xml", drawingXml());
  zip.file(
    "xl/drawings/_rels/drawing1.xml.rels",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="../media/image1.jpeg"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/chart" Target="../charts/chart1.xml"/>
</Relationships>`,
  );
  zip.file("xl/charts/chart1.xml", chartXml(lastRow, opts.title));
  zip.file("xl/media/image1.jpeg", opts.jpeg);
  const blob = await zip.generateAsync({
    type: "blob",
    mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    compression: "DEFLATE",
  });
  await writeSave(opts.handle ?? null, blob, opts.filename);
}

export function excelExportFilename(currency: string, range: string): string {
  const day = new Date().toISOString().slice(0, 10);
  const unit = currency === "XAU" ? "gold" : currency.toLowerCase();
  return `orange-law-${unit}-${range}-${day}.xlsx`;
}

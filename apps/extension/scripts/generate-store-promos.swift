import AppKit

let root = URL(fileURLWithPath: FileManager.default.currentDirectoryPath)
let iconURL = root.appendingPathComponent("public/icons/icon128.png")
let logoURL = root.appendingPathComponent("Prompt Accel Logo.jpg")
let webStoreLogoURL = root.appendingPathComponent("Prompt Acel Logo Web Store.jpg")
let outputDir = root.appendingPathComponent("store-assets/chrome")

func loadImage(_ url: URL) -> NSImage {
    guard let image = NSImage(contentsOf: url) else {
        fatalError("Could not load image: \(url.path)")
    }

    if let rep = image.representations.first {
        image.size = NSSize(width: rep.pixelsWide, height: rep.pixelsHigh)
    }

    return image
}

let icon = loadImage(iconURL)
let logo = loadImage(logoURL)
let marqueeSource = FileManager.default.fileExists(atPath: webStoreLogoURL.path)
    ? loadImage(webStoreLogoURL)
    : logo

let black = NSColor(red: 0.015, green: 0.015, blue: 0.018, alpha: 1)
let charcoal = NSColor(red: 0.055, green: 0.055, blue: 0.062, alpha: 1)
let gold = NSColor(red: 0.94, green: 0.65, blue: 0.18, alpha: 1)
let paleGold = NSColor(red: 1.0, green: 0.84, blue: 0.38, alpha: 1)
let warmWhite = NSColor(red: 0.94, green: 0.91, blue: 0.84, alpha: 1)
let mutedWhite = NSColor(red: 0.82, green: 0.80, blue: 0.74, alpha: 1)

func topRect(_ x: CGFloat, _ y: CGFloat, _ width: CGFloat, _ height: CGFloat, canvasHeight: CGFloat) -> NSRect {
    NSRect(x: x, y: canvasHeight - y - height, width: width, height: height)
}

func sourceRectTop(_ image: NSImage, _ x: CGFloat, _ y: CGFloat, _ width: CGFloat, _ height: CGFloat) -> NSRect {
    NSRect(x: x, y: image.size.height - y - height, width: width, height: height)
}

func fill(_ color: NSColor, _ rect: NSRect) {
    color.setFill()
    NSBezierPath(rect: rect).fill()
}

func fillRounded(_ color: NSColor, _ rect: NSRect, radius: CGFloat) {
    color.setFill()
    NSBezierPath(roundedRect: rect, xRadius: radius, yRadius: radius).fill()
}

func strokeRounded(_ color: NSColor, _ rect: NSRect, radius: CGFloat, lineWidth: CGFloat) {
    color.setStroke()
    let path = NSBezierPath(roundedRect: rect, xRadius: radius, yRadius: radius)
    path.lineWidth = lineWidth
    path.stroke()
}

func drawText(
    _ text: String,
    x: CGFloat,
    y: CGFloat,
    width: CGFloat,
    height: CGFloat,
    canvasHeight: CGFloat,
    font: NSFont,
    color: NSColor,
    kern: CGFloat = 0,
    alignment: NSTextAlignment = .left
) {
    let paragraph = NSMutableParagraphStyle()
    paragraph.alignment = alignment
    paragraph.lineBreakMode = .byTruncatingTail

    let attributes: [NSAttributedString.Key: Any] = [
        .font: font,
        .foregroundColor: color,
        .kern: kern,
        .paragraphStyle: paragraph
    ]

    NSString(string: text).draw(
        in: topRect(x, y, width, height, canvasHeight: canvasHeight),
        withAttributes: attributes
    )
}

func drawRoundedImage(_ image: NSImage, in rect: NSRect, radius: CGFloat, alpha: CGFloat = 1) {
    NSGraphicsContext.saveGraphicsState()
    NSBezierPath(roundedRect: rect, xRadius: radius, yRadius: radius).addClip()
    image.draw(in: rect, from: .zero, operation: .sourceOver, fraction: alpha)
    NSGraphicsContext.restoreGraphicsState()
}

func withShadow(color: NSColor, blur: CGFloat, offset: NSSize, draw: () -> Void) {
    NSGraphicsContext.saveGraphicsState()
    let shadow = NSShadow()
    shadow.shadowColor = color
    shadow.shadowBlurRadius = blur
    shadow.shadowOffset = offset
    shadow.set()
    draw()
    NSGraphicsContext.restoreGraphicsState()
}

func drawDividerGlow(canvasHeight: CGFloat, y: CGFloat, x: CGFloat, width: CGFloat) {
    let rect = topRect(x, y, width, 2, canvasHeight: canvasHeight)
    NSGradient(colors: [
        gold.withAlphaComponent(0),
        paleGold.withAlphaComponent(0.95),
        gold.withAlphaComponent(0)
    ])?.draw(in: rect, angle: 0)
}

func render(width: Int, height: Int, output: URL, draw: (CGFloat, CGFloat) -> Void) {
    guard let rep = NSBitmapImageRep(
        bitmapDataPlanes: nil,
        pixelsWide: width,
        pixelsHigh: height,
        bitsPerSample: 8,
        samplesPerPixel: 4,
        hasAlpha: true,
        isPlanar: false,
        colorSpaceName: .deviceRGB,
        bytesPerRow: 0,
        bitsPerPixel: 0
    ) else {
        fatalError("Could not create bitmap")
    }

    rep.size = NSSize(width: width, height: height)
    guard let context = NSGraphicsContext(bitmapImageRep: rep) else {
        fatalError("Could not create graphics context")
    }

    NSGraphicsContext.saveGraphicsState()
    NSGraphicsContext.current = context
    context.shouldAntialias = true
    context.cgContext.setShouldAntialias(true)
    context.cgContext.setAllowsAntialiasing(true)
    draw(CGFloat(width), CGFloat(height))
    NSGraphicsContext.restoreGraphicsState()

    guard let data = rep.representation(using: .png, properties: [:]) else {
        fatalError("Could not encode PNG")
    }

    do {
        try FileManager.default.createDirectory(at: output.deletingLastPathComponent(), withIntermediateDirectories: true)
        try data.write(to: output, options: .atomic)
    } catch {
        fatalError("Could not write \(output.path): \(error)")
    }
}

func drawSmallPromo(width: CGFloat, height: CGFloat) {
    let canvas = NSRect(x: 0, y: 0, width: width, height: height)
    fill(black, canvas)

    logo.draw(
        in: canvas,
        from: sourceRectTop(logo, 0, 0, 980, 624),
        operation: .sourceOver,
        fraction: 0.58
    )
    fill(NSColor.black.withAlphaComponent(0.64), canvas)

    NSGradient(colors: [
        black.withAlphaComponent(0.95),
        charcoal.withAlphaComponent(0.62),
        gold.withAlphaComponent(0.2)
    ])?.draw(in: canvas, angle: -14)

    NSGradient(colors: [
        paleGold.withAlphaComponent(0.42),
        gold.withAlphaComponent(0.0)
    ])?.draw(
        fromCenter: NSPoint(x: 126, y: height - 136),
        radius: 0,
        toCenter: NSPoint(x: 126, y: height - 136),
        radius: 180,
        options: [.drawsAfterEndingLocation]
    )

    let iconFrame = topRect(42, 58, 108, 108, canvasHeight: height)
    withShadow(color: NSColor.black.withAlphaComponent(0.65), blur: 18, offset: NSSize(width: 0, height: -8)) {
        fillRounded(NSColor.white, iconFrame, radius: 22)
    }
    drawRoundedImage(icon, in: iconFrame.insetBy(dx: 0, dy: 0), radius: 22)
    strokeRounded(gold.withAlphaComponent(0.72), iconFrame.insetBy(dx: 0.5, dy: 0.5), radius: 22, lineWidth: 1.5)

    let titleFont = NSFont(name: "Arial Black", size: 34) ?? .boldSystemFont(ofSize: 34)
    let accelFont = NSFont(name: "Arial Bold", size: 19) ?? .boldSystemFont(ofSize: 19)
    let tagFont = NSFont(name: "Arial", size: 14) ?? .systemFont(ofSize: 14)
    let miniFont = NSFont(name: "Arial Bold", size: 10) ?? .boldSystemFont(ofSize: 10)

    drawText("PROMPT", x: 173, y: 70, width: 240, height: 42, canvasHeight: height, font: titleFont, color: paleGold, kern: 1.0)
    drawText("ACCELERATOR", x: 176, y: 112, width: 230, height: 24, canvasHeight: height, font: accelFont, color: warmWhite, kern: 5.2)
    drawDividerGlow(canvasHeight: height, y: 154, x: 176, width: 205)
    drawText("WRITE BETTER. THINK FASTER.", x: 176, y: 172, width: 230, height: 22, canvasHeight: height, font: tagFont, color: mutedWhite, kern: 0.9)
    drawText("LUXCRYPTA TECHNOLOGIES", x: 176, y: 214, width: 220, height: 18, canvasHeight: height, font: miniFont, color: paleGold, kern: 1.5)
}

func drawChip(_ text: String, x: CGFloat, y: CGFloat, width: CGFloat, canvasHeight: CGFloat) {
    let rect = topRect(x, y, width, 42, canvasHeight: canvasHeight)
    fillRounded(NSColor.black.withAlphaComponent(0.38), rect, radius: 18)
    strokeRounded(gold.withAlphaComponent(0.55), rect.insetBy(dx: 0.5, dy: 0.5), radius: 18, lineWidth: 1)
    let font = NSFont(name: "Arial Bold", size: 16) ?? .boldSystemFont(ofSize: 16)
    drawText(text, x: x, y: y + 12, width: width, height: 20, canvasHeight: canvasHeight, font: font, color: warmWhite, kern: 1.2, alignment: .center)
}

func drawMarquee(width: CGFloat, height: CGFloat) {
    let canvas = NSRect(x: 0, y: 0, width: width, height: height)
    fill(black, canvas)

    let targetAspect = width / height
    let sourceAspect = marqueeSource.size.width / marqueeSource.size.height
    let coverRect: NSRect

    if sourceAspect < targetAspect {
        let cropHeight = marqueeSource.size.width / targetAspect
        let preferredTopCrop: CGFloat = 130
        let topCrop = min(max(0, preferredTopCrop), marqueeSource.size.height - cropHeight)
        coverRect = sourceRectTop(
            marqueeSource,
            0,
            topCrop,
            marqueeSource.size.width,
            cropHeight
        )
    } else {
        let cropWidth = marqueeSource.size.height * targetAspect
        let leftCrop = (marqueeSource.size.width - cropWidth) / 2
        coverRect = NSRect(
            x: leftCrop,
            y: 0,
            width: cropWidth,
            height: marqueeSource.size.height
        )
    }

    marqueeSource.draw(
        in: canvas,
        from: coverRect,
        operation: .sourceOver,
        fraction: 0.42
    )
    fill(NSColor.black.withAlphaComponent(0.50), canvas)

    let heroCropHeight = min(marqueeSource.size.height, (marqueeSource.size.width / targetAspect) * 1.12)
    let preferredHeroTopCrop: CGFloat = 94
    let heroTopCrop = min(max(0, preferredHeroTopCrop), marqueeSource.size.height - heroCropHeight)
    let heroSourceRect = sourceRectTop(
        marqueeSource,
        0,
        heroTopCrop,
        marqueeSource.size.width,
        heroCropHeight
    )
    let heroWidth = height * (heroSourceRect.width / heroSourceRect.height)
    let heroTargetRect = NSRect(
        x: (width - heroWidth) / 2,
        y: 0,
        width: heroWidth,
        height: height
    )

    marqueeSource.draw(
        in: heroTargetRect,
        from: heroSourceRect,
        operation: .sourceOver,
        fraction: 1
    )
}

render(
    width: 440,
    height: 280,
    output: outputDir.appendingPathComponent("small-promo-440x280.png"),
    draw: drawSmallPromo
)

render(
    width: 1400,
    height: 560,
    output: outputDir.appendingPathComponent("marquee-1400x560.png"),
    draw: drawMarquee
)

print("Generated:")
print(outputDir.appendingPathComponent("small-promo-440x280.png").path)
print(outputDir.appendingPathComponent("marquee-1400x560.png").path)

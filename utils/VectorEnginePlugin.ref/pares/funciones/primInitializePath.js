function primInitializePath(argCount) {
    spanLeft = targetWidth;      // drawable right. Will later be refined.
    spanTop = targetHeight;      // drawable bottom. Will later be refined.
    spanRight = 0;               // drawable left. Will later be refined.
    spanBottom = 0;              // drawable top. Will later be refined.
    prevYRounded = 0x7FFFFFFF;
    return true;
}

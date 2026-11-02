// tfjs 3.21 워커 버그 우회: PlatformBrowser.setTimeoutCustom 이 window 를 참조 (스파이크 1단계 1-5장)
self.window = self;

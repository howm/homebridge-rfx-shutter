import * as WindowCover from './WindowCover';

export default function HomeBridgeBlindPlugin(homeBridge: any): void {
  homeBridge.registerAccessory(
    'homebridge-rfx-shutter',
    'HomebridgeRfxShutter',
    WindowCover.getClass(homeBridge.hap.Service, homeBridge.hap.Characteristic),
  );
}

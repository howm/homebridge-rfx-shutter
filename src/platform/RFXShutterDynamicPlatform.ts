import {
  API,
  APIEvent,
  DynamicPlatformPlugin,
  HAP,
  Logging,
  PlatformAccessory,
  PlatformConfig,
} from 'homebridge';

import ShutterAccessory, {
  ShutterAccessoryConfig,
} from '../accessory/ShutterAccessory';
import { listRemotes, Remote, setup } from '../service/rfxcom';

const DEFAULT_TTY = '/dev/ttyUSB0';

let Accessory: typeof PlatformAccessory;

export const PLUGIN_NAME = 'homebridge-rfx-shutter';
export const PLATFORM_NAME = 'RFXShutterDynamicPlatform';

interface RFXShutterConfig extends PlatformConfig, ShutterAccessoryConfig {
  tty?: string;
  excludedDeviceIds?: string[];
}

export default class RFXShutterDynamicPlatform
  implements DynamicPlatformPlugin {
  private readonly log: Logging;

  private readonly api: API;

  private readonly hap: HAP;

  private readonly config: RFXShutterConfig;

  private readonly accessoryByDeviceId: Map<string, ShutterAccessory> = new Map<
    string,
    ShutterAccessory
  >();

  public constructor(log: Logging, config: RFXShutterConfig, api: API) {
    this.log = log;
    this.api = api;
    this.hap = api.hap;
    this.config = config;
    Accessory = api.platformAccessory;

    setup(config.tty || DEFAULT_TTY);

    this.api.on(
      APIEvent.DID_FINISH_LAUNCHING,
      async (): Promise<void> => {
        log('[constructor] Listing shutters ...');
        const remotes: Remote[] = await listRemotes(log);
        log(
          '[constructor] Found',
          remotes.length,
          'already detected',
          this.accessoryByDeviceId.size,
        );

        remotes.forEach((remote: Remote): void => {
          const isExcludedDevice = this.config.excludedDeviceIds?.includes(
            remote.deviceId,
          );

          if (this.accessoryByDeviceId.has(remote.deviceId)) {
            if (isExcludedDevice) {
              const {
                accessory,
              }: ShutterAccessory = this.accessoryByDeviceId.get(
                remote.deviceId,
              )!;
              this.api.unregisterPlatformAccessories(
                PLUGIN_NAME,
                PLATFORM_NAME,
                [accessory],
              );
            }
            return;
          }

          if (isExcludedDevice) return;

          const displayName = `Shutter ${remote.deviceId}`;
          const accessory = new Accessory(
            displayName,
            this.hap.uuid.generate(remote.deviceId),
          );

          accessory.context = {
            deviceId: remote.deviceId,
          };

          this.log('[constructor] Adding', displayName);
          accessory.addService(
            this.hap.Service.WindowCovering,
            `RFX / ${displayName}`,
          );

          this.configureAccessory(accessory);
          this.api.registerPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [
            accessory,
          ]);
        });
      },
    );
  }

  public configureAccessory(accessory: PlatformAccessory): void {
    this.log(
      '[configureAccessory] Configuring accessory',
      accessory.displayName,
    );

    this.accessoryByDeviceId.set(
      accessory.context.deviceId,
      new ShutterAccessory(this.log, this.api, accessory, {
        openSeconds: this.config.openSeconds,
        closeSeconds: this.config.closeSeconds,
      }),
    );
  }
}

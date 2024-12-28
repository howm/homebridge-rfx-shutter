import {
  API,
  CharacteristicEventTypes,
  CharacteristicGetCallback,
  CharacteristicSetCallback,
  HAP,
  Logging,
  PlatformAccessory,
  PlatformAccessoryEvent,
  CharacteristicValue,
} from 'homebridge';
import wait from 'waait';

import { ShutterAction, fireShutterAction } from '../service/rfxcom';

const DEFAULT_CURRENT_POSITION = 0;
const DEFAULT_TARGET_POSITION = 0;
const DEFAULT_OPEN_SECONDS = 25;
const DEFAULT_CLOSE_SECONDS = 22;
enum PositionState {
  DECREASING = 0,
  INCREASING = 1,
  STOPPED = 2,
}

type Required<T> = { [K in keyof T]-?: T[K] };
const cache: { [key: string]: any } = {};

export interface ShutterAccessoryConfig {
  openSeconds?: number;
  closeSeconds?: number;
  direction?: 'normal' | 'reverse';
}

export default class ShutterAccessory {
  private readonly log: Logging;

  private readonly hap: HAP;

  public readonly accessory: PlatformAccessory;

  private readonly serial: string;

  private currentPosition; //= value as number || DEFAULT_CURRENT_POSITION;

  private targetPosition; // || DEFAULT_TARGET_POSITION;

  private positionState: number = PositionState.STOPPED;

  private readonly config: Required<ShutterAccessoryConfig>;

  public constructor(
    log: Logging,
    api: API,
    accessory: PlatformAccessory,
    config: ShutterAccessoryConfig,
  ) {
    this.log = log;
    this.hap = api.hap;
    this.accessory = accessory;
    this.serial = accessory.context.deviceId;
    this.config = {
      openSeconds: config.openSeconds || DEFAULT_OPEN_SECONDS,
      closeSeconds: config.closeSeconds || DEFAULT_CLOSE_SECONDS,
      direction: config.direction || 'normal',
    };

    // this.currentPosition = this.hap.Service.getItemSync(`currentPosition_${this.serial}`);
    this.currentPosition =
      cache[`currentPosition_${this.serial}`] || DEFAULT_CURRENT_POSITION;
    // this.targetPosition = this.hap.Service.getItemSync(`targetPosition_${this.serial}`);
    this.targetPosition =
      cache[`targetPosition_${this.serial}`] || DEFAULT_TARGET_POSITION;
    accessory.on(PlatformAccessoryEvent.IDENTIFY, (): void => {
      this.log(accessory.displayName, ' identified!');
    });

    // AccessoryInformation
    const accessoryInformationService = accessory.getService(
      this.hap.Service.AccessoryInformation,
    );
    accessoryInformationService?.setCharacteristic(
      this.hap.Characteristic.Manufacturer,
      'RFX',
    );
    accessoryInformationService?.setCharacteristic(
      this.hap.Characteristic.Model,
      'RFXtrx433E',
    );
    accessoryInformationService?.setCharacteristic(
      this.hap.Characteristic.SerialNumber,
      this.serial,
    );

    // WindowCovering
    const windowCoveringService = this.accessory.getService(
      this.hap.Service.WindowCovering,
    )!;
    windowCoveringService
      .getCharacteristic(this.hap.Characteristic.CurrentPosition)
      .on(CharacteristicEventTypes.GET, this.getCurrentPosition.bind(this));

    windowCoveringService
      .getCharacteristic(this.hap.Characteristic.TargetPosition)
      .on(CharacteristicEventTypes.GET, this.getTargetPosition.bind(this))
      .on(CharacteristicEventTypes.SET, this.setTargetPosition.bind(this));

    windowCoveringService
      .getCharacteristic(this.hap.Characteristic.PositionState)
      .on(CharacteristicEventTypes.GET, this.getPositionState.bind(this));
  }

  public getCurrentPosition(cb: CharacteristicGetCallback): void {
    this.log(`getCurrentPosition ${this.currentPosition} for ${this.serial}`);
    cb(null, this.currentPosition);
  }

  public getTargetPosition(cb: CharacteristicGetCallback): void {
    this.log(`getTargetPosition ${this.targetPosition} for ${this.serial}`);
    cb(null, this.targetPosition);
  }

  public getShutterAction(up: boolean): ShutterAction {
    if (this.config.direction === 'reverse') {
      return up ? ShutterAction.DOWN : ShutterAction.UP;
    }
    return up ? ShutterAction.UP : ShutterAction.DOWN;
  }

  public async setTargetPosition(
    value: CharacteristicValue,
    cb: CharacteristicSetCallback,
  ): Promise<void> {
    this.log(`setTargetPosition ${value} for ${this.serial}`);
    // Save to cache
    // this.hap.Service.setItemSync(`targetPosition_${this.serial}`, value);
    cache[`targetPosition_${this.serial}`] = value;
    /**
     * It seems that the cb need to be called to say that we understand the action. When delayed
     * until the position stop Siri complain about communication problem with the device.
     */
    cb(null, value);

    this.targetPosition = value as number;

    if (this.targetPosition === this.currentPosition) return;

    const up: boolean = this.targetPosition > this.currentPosition;
    this.setPositionState(
      up ? PositionState.INCREASING : PositionState.DECREASING,
    );
    fireShutterAction(this.serial, this.getShutterAction(up));

    await wait(
      (Math.abs(this.targetPosition - this.currentPosition) / 100) *
        ((up ? this.config.openSeconds : this.config.closeSeconds) * 1000),
    );

    if (this.targetPosition !== 100 && this.targetPosition !== 0) {
      // Otherwise the stop button will fire the "memo" command
      this.log(`fireShutterAction ${ShutterAction.STOP}`);
      fireShutterAction(this.serial, ShutterAction.STOP);
    }
    this.setPositionState(PositionState.STOPPED);
    this.setCurrentPosition(this.targetPosition);
  }

  public setCurrentPosition(value: number): void {
    this.log(`setCurrentPosition to ${value} for ${this.serial}`);
    this.currentPosition = value;
    // Save to cache
    // this.hap.Service.setItemSync(`currentPosition_${this.serial}`, value);
    cache[`currentPosition_${this.serial}`] = value;
    this.accessory
      .getService(this.hap.Service.WindowCovering)!
      .setCharacteristic(this.hap.Characteristic.CurrentPosition, value);
  }

  public getPositionState(cb: CharacteristicGetCallback): void {
    this.log(`getPositionState ${this.positionState} for ${this.serial}`);
    cb(null, this.positionState);
  }

  public setPositionState(positionState: PositionState): void {
    this.log(`setPositionState to ${positionState} for ${this.serial}`);
    this.positionState = positionState;
    this.accessory
      .getService(this.hap.Service.WindowCovering)!
      .setCharacteristic(this.hap.Characteristic.PositionState, positionState);
  }
}

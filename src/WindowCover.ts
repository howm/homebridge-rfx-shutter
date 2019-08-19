import wait from 'waait';
import {
  BlindAction,
  fireShutterAction,
  listRemotes,
  Remote,
  setup,
} from './service/rfxcom';

type Logger = (message: string) => void;
type Callback<T> = (err: Error | null, result: T) => void;

enum PositionState {
  DECREASING = 0,
  INCREASING = 1,
  STOPPED = 2,
}

export interface WindowCoverOptions {
  name: string;
  tty: string;
  deviceId: string;
  openSeconds: number;
  closeSeconds: number;
}

interface WindowCoverInterface {
  getServices(): [any, any];
}

interface WindowCoverClass {
  new (log: Logger, config: WindowCoverOptions): WindowCoverInterface;
}

export function getClass(Service: any, Characteristic: any): WindowCoverClass {
  return class WindowCover implements WindowCoverInterface {
    private readonly log: Logger;

    private readonly config: WindowCoverOptions;

    private currentPosition: number = 0;

    private readonly service: any;

    private targetPosition = 0;

    private positionState: number;

    public constructor(log: Logger, config: WindowCoverOptions) {
      this.log = log;
      this.config = config;
      this.config.tty = this.config.tty || '/dev/ttyUSB0';
      this.config.closeSeconds =
        this.config.closeSeconds || this.config.openSeconds;

      this.service = new Service.WindowCovering(config.name);

      setup(this.config.tty);
      listRemotes()
        .then((remotes: Remote[]): void => {
          remotes.forEach((remote: Remote): void =>
            this.log(`Found device ${remote.deviceId}`),
          );

          if (
            !remotes.some(
              ({ deviceId }: Remote): boolean =>
                deviceId === this.config.deviceId,
            )
          ) {
            throw new Error('Device id not found');
          }
        })
        .catch((err: Error): void => this.log(err.message));
      this.setPositionState(Characteristic.PositionState.STOPPED);
    }

    private getCurrentPosition(cb: Callback<number>): void {
      this.log(
        `getCurrentPosition ${this.currentPosition} for ${this.config.deviceId}`,
      );
      cb(null, this.currentPosition);
    }

    private getName(cb: Callback<string>): void {
      this.log(`getName ${this.config.name} for ${this.config.deviceId}`);
      cb(null, this.config.name);
    }

    private getTargetPosition(cb: Callback<number>): void {
      this.log(
        `getTargetPosition ${this.targetPosition} for ${this.config.deviceId}`,
      );
      cb(null, this.targetPosition);
    }

    private async setTargetPosition(
      value: number,
      cb: Callback<null>,
    ): Promise<void> {
      this.log(`setTargetPosition ${value} for ${this.config.deviceId}`);
      this.targetPosition = value;

      if (this.targetPosition === this.currentPosition) {
        return cb(null, null);
      }

      const up: boolean = this.targetPosition > this.currentPosition;
      this.setPositionState(
        up
          ? Characteristic.PositionState.INCREASING
          : Characteristic.PositionState.DECREASING,
      );
      fireShutterAction(
        this.config.deviceId,
        up ? BlindAction.UP : BlindAction.DOWN,
      );
      await wait(
        (Math.abs(this.targetPosition - this.currentPosition) / 100) *
          (this.config.openSeconds * 1000),
      );

      if (this.targetPosition !== 100 && this.targetPosition !== 0) {
        // Otherwise the stop button will fire the "memo" command
        this.log(`fireShutterAction ${BlindAction.STOP}`);
        fireShutterAction(this.config.deviceId, BlindAction.STOP);
      }

      this.setCurrentPosition(this.targetPosition);
      return cb(null, null);
    }

    private setCurrentPosition(value: number): void {
      this.log(`setCurrentPosition to ${value} for ${this.config.deviceId}`);
      this.currentPosition = value;
      this.service.setCharacteristic(Characteristic.CurrentPosition, value);
      this.service.setCharacteristic(
        Characteristic.PositionState,
        Characteristic.PositionState.STOPPED,
      );
    }

    private getPositionState(cb: Callback<PositionState>): void {
      this.log(
        `getPositionState ${this.positionState} for ${this.config.deviceId}`,
      );
      cb(null, this.positionState);
    }

    private setPositionState(positionState: PositionState): void {
      this.log(
        `setPositionState to ${positionState} for ${this.config.deviceId}`,
      );
      this.positionState = positionState;
      this.service.setCharacteristic(
        Characteristic.PositionState,
        positionState,
      );
    }

    public getServices(): [any, any] {
      const informationService = new Service.AccessoryInformation();

      informationService
        .setCharacteristic(Characteristic.Manufacturer, 'RFXCom')
        .setCharacteristic(Characteristic.Model, 'RFXtrx433(E)')
        .setCharacteristic(Characteristic.SerialNumber, '0');

      this.service
        .getCharacteristic(Characteristic.Name)
        .on('get', this.getName.bind(this));

      this.service
        .getCharacteristic(Characteristic.CurrentPosition)
        .on('get', this.getCurrentPosition.bind(this));

      this.service
        .getCharacteristic(Characteristic.TargetPosition)
        .on('get', this.getTargetPosition.bind(this))
        .on('set', this.setTargetPosition.bind(this));

      this.service
        .getCharacteristic(Characteristic.PositionState)
        .on('get', this.getPositionState.bind(this));

      return [informationService, this.service];
    }
  };
}

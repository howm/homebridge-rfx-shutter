import { API } from 'homebridge';
import RFXShutterDynamicPlatform, {
  PLATFORM_NAME,
} from './platform/RFXShutterDynamicPlatform';

/*
 * Initializer function called when the plugin is loaded.
 */
export = (api: API): void => {
  api.registerPlatform(PLATFORM_NAME, RFXShutterDynamicPlatform);
};

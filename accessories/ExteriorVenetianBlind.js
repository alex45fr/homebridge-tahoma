var Service, Characteristic, Command, ExecutionState, State, AbstractAccessory;

module.exports = function(homebridge, abstractAccessory, api) {
    AbstractAccessory = abstractAccessory;
    Service = homebridge.hap.Service;
    Characteristic = homebridge.hap.Characteristic;
    Command = api.Command;
    ExecutionState = api.ExecutionState;
    State = api.State;

    return ExteriorVenetianBlind;
}

/**
 * Accessory "ExteriorVenetianBlind"
 */
 
ExteriorVenetianBlind = function(log, api, device, config) {
    AbstractAccessory.call(this, log, api, device);
    var service = new Service.WindowCovering(device.label);

    this.currentPosition = service.getCharacteristic(Characteristic.CurrentPosition);
    this.targetPosition = service.getCharacteristic(Characteristic.TargetPosition);
    this.targetPosition.on('set', this.setPosition.bind(this));
    this.positionState = service.getCharacteristic(Characteristic.PositionState);
    this.positionState.updateValue(Characteristic.PositionState.STOPPED);
    
    if(this.device.widget == 'PositionableExteriorVenetianBlind') {
    	this.currentAngle = service.addCharacteristic(Characteristic.CurrentHorizontalTiltAngle);
    	this.targetAngle = service.addCharacteristic(Characteristic.TargetHorizontalTiltAngle);
    	this.targetAngle.on('set', this.setAngle.bind(this));
    }
    
    this.services.push(service);
};

ExteriorVenetianBlind.UUID = 'ExteriorVenetianBlind';

ExteriorVenetianBlind.prototype = {

	/**
	* Triggered when Homekit try to modify the Characteristic.TargetPosition
	**/
    setPosition: function(value, callback) {
        var that = this;
        if (this.lastExecId in this.api.executionCallback) {
            this.api.cancelCommand(this.lastExecId, function() {});
        }

				that.log('['+that.name+'] setClosure, value='+value);
        var command = new Command('setClosure');
        command.parameters = [100 - value];
        this.executeCommand(command, function(status, error, data) {
            //that.log('['+that.name+'] ' + command.name + ' ' + status);
            switch (status) {
                case ExecutionState.INITIALIZED:
                    callback(error);
                    break;
                case ExecutionState.IN_PROGRESS:
                    var newValue = (value == 0 || value < that.currentPosition.value) ? Characteristic.PositionState.INCREASING : Characteristic.PositionState.DECREASING;
                    that.positionState.updateValue(newValue);
                    that.log.debug('['+that.name+'] Command in progress, state='+newValue);
                	break;
                case ExecutionState.COMPLETED:
                case ExecutionState.FAILED:
                    that.positionState.updateValue(Characteristic.PositionState.STOPPED);
                    that.targetPosition.updateValue(that.currentPosition.value); // Update target position in case of cancellation
                    break;
                default:
                    break;
            }
        });
    },
    
    /**
	* Triggered when Homekit try to modify the Characteristic.TargetAngle
	**/
    setAngle: function(value, callback) {
        var that = this;
        if (this.lastExecId in this.api.executionCallback) {
            this.api.cancelCommand(this.lastExecId, function() {});
        }

        var command = new Command('setOrientation');
        command.parameters = [Math.round((value + 90)/1.8)];
        this.executeCommand(command, function(status, error, data) {
            //that.log('['+that.name+'] ' + command.name + ' ' + status);
            switch (status) {
                case ExecutionState.INITIALIZED:
                    callback(error);
                    break;
                case ExecutionState.COMPLETED:
                case ExecutionState.FAILED:
                    that.targetAngle.updateValue(that.currentAngle.value); // Update target position in case of cancellation
                    break;
                default:
                    break;
            }
        });
    },

    onStateUpdate: function(name, value) {
    	if (name == State.STATE_CLOSURE) {
					this.log('['+this.name+'] ' + name + '=' + value); // For analysis
					var converted = 100 - value;
					this.currentPosition.updateValue(converted);
					if (!this.isCommandInProgress()) // if no command running, update target
							this.targetPosition.updateValue(converted);
			} else if (name == 'core:SlateOrientationState') {
					this.log('['+this.name+'] ' + name + '=' + value); // For analysis
					var converted = Math.round(value * 1.8 - 90);
					if(this.currentAngle)
						this.currentAngle.updateValue(converted);
					if (this.targetAngle && !this.isCommandInProgress()) // if no command running, update target
							this.targetAngle.updateValue(converted);
			}
    }
}
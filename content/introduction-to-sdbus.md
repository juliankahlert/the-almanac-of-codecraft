# Introduction to SDBus: The Power of Modern D-Bus Communication in C

D-Bus is the standard interprocess communication (IPC) mechanism on linux that allows different services and applications to communicate with each other.
While many libraries provide support for D-Bus, `libsystemd`'s **SDBus** is arguably the best choice due to its simplicity, performance,
and integration with the systemd ecosystem.
This guide will introduce you to SDBus, demonstrating how to create a simple service that handles messages and emits signals.

## Code Overview

Here is an example of a simple SDBus service implemented in C.
The service exposes an `Enabled` state, allowing clients to query its value, toggle it, and listen for changes.

```c
#include <stdlib.h>
#include <string.h>
#include <unistd.h>
#include <stdio.h>

#include <systemd/sd-bus-vtable.h>
#include <systemd/sd-bus.h>

static int enabled = 0;
static const char *bus_name = "io.test.EnabledService";
static const char *object_path = "/io/test/EnabledService";

/**
 * signal_handler - Handles the "EnabledChanged" signal from the D-Bus.
 *
 * This function is called whenever the "EnabledChanged" signal is received.
 * It extracts the new value from the signal message and processes it,
 * printing the updated value to the console.
 *
 * Returns 0 on success or a negative error code on failure.
 */
static int signal_handler(sd_bus_message *m, void *userdata, sd_bus_error *ret_error)
{
	int new_value;
	int r;

	r = sd_bus_message_read(m, "i", &new_value);
	if (r < 0) {
		fprintf(stderr, "Error reading EnabledChanged signal: %s\n", strerror(-r));
		return r;
	}

	printf("Received EnabledChanged signal, new value: %d\n", new_value);
	return 0;
}

/**
 * set_enabled - Handles the "SetEnabled" method call from the D-Bus.
 *
 * This function processes a method call to set the "enabled" state.
 * It reads the new value from the message, updates the internal "enabled"
 * variable, and emits the "EnabledChanged" signal to notify clients about the change.
 *
 * Returns 0 on success or a negative error code on failure.
 */
static int set_enabled(sd_bus_message *m, void *userdata, sd_bus_error *ret_error)
{
	sd_bus *bus = NULL;
	int new_value;
	int r;

	bus = userdata;

	printf("Attempting to read new value from message...\n");
	r = sd_bus_message_read(m, "i", &new_value);
	if (r < 0) {
		fprintf(stderr, "Error reading message: %s\n", strerror(-r));
		return r;
	}

	printf("New value read: %d\n", new_value);

	enabled = new_value;
	printf("Enabled variable updated to: %d\n", enabled);

	printf("Emitting signal 'EnabledChanged' with value: %d\n", enabled);
	r = sd_bus_emit_signal(bus, object_path, "io.test.EnabledService", "EnabledChanged", "i",
			       enabled);
	if (r < 0) {
		fprintf(stderr, "Error emitting signal: %s\n", strerror(-r));
		return r;
	}

	return sd_bus_reply_method_return(m, NULL);
}

/**
 * get_enabled - Handles the "GetEnabled" method call from the D-Bus.
 *
 * This function processes a method call to retrieve the current value of the
 * "enabled" state and sends it back as a reply to the caller.
 *
 * Returns 0 on success or a negative error code on failure.
 */
static int get_enabled(sd_bus_message *m, void *userdata, sd_bus_error *ret_error)
{
	printf("Sending current value of 'enabled': %d\n", enabled);
	return sd_bus_reply_method_return(m, "i", enabled);
}

/**
 * example_vtable - Defines the method and signal interface for the D-Bus service.
 *
 * This vtable maps the "SetEnabled" and "GetEnabled" method calls and the
 * "EnabledChanged" signal to their respective handler functions. It provides
 * the necessary type signatures and access control for each method and signal.
 */
static const sd_bus_vtable example_vtable[] = {
	SD_BUS_VTABLE_START(0),
	SD_BUS_METHOD("SetEnabled", "i", SD_BUS_NO_RESULT, set_enabled, SD_BUS_VTABLE_UNPRIVILEGED),
	SD_BUS_METHOD("GetEnabled", SD_BUS_NO_ARGS, "i", get_enabled, SD_BUS_VTABLE_UNPRIVILEGED),
	SD_BUS_SIGNAL("EnabledChanged", "i", 0),
	SD_BUS_VTABLE_END,
};

/**
 * setup_bus - Sets up the D-Bus interface and registers the object with the bus.
 *
 * This function registers the object path and interface with the D-Bus bus,
 * linking the vtable that defines the methods and signals. It prepares the service
 * to handle incoming method calls and emit signals.
 *
 * Returns 0 on success or a negative error code on failure.
 */
static int setup_bus(sd_bus *bus)
{
	sd_bus_slot *slot = NULL;
	int r;

	printf("Setting up bus at path: %s\n", object_path);
	printf("Interface Name: io.test.EnabledService\n");

	r = sd_bus_add_object_vtable(bus, &slot, object_path, "io.test.EnabledService",
				     example_vtable, bus);
	if (r < 0) {
		fprintf(stderr, "Failed to add object vtable: %s\n", strerror(-r));
		return r;
	}

	return 0;
}

/**
 * create_bus_connection - Establishes a connection to the D-Bus.
 *
 * Returns 0 on success or a negative error code on failure.
 */
static int create_bus_connection(sd_bus **bus)
{
	int r;

	r = sd_bus_open_user(bus);
	if (r < 0) {
		fprintf(stderr, "Failed to connect to D-Bus: %s\n", strerror(-r));
		return r;
	}

	printf("Connected to D-Bus successfully.\n");
	return 0;
}

/**
 * request_dbus_name - Requests a unique name on the D-Bus for the service.
 *
 * Returns 0 on success or a negative error code on failure.
 */
static int request_dbus_name(sd_bus *bus)
{
	int r;

	r = sd_bus_request_name(bus, bus_name, 0);
	if (r < 0) {
		fprintf(stderr, "Failed to request D-Bus name '%s': %s\n", bus_name, strerror(-r));
		return r;
	}

	printf("Requested D-Bus name: %s\n", bus_name);
	return 0;
}

/**
 * setup_dbus_bus - Initializes the D-Bus bus and prepares the service.
 *
 * Returns 0 on success or a negative error code on failure.
 */
static int setup_dbus_bus(sd_bus *bus)
{
	int r;

	r = setup_bus(bus);
	if (r < 0) {
		fprintf(stderr, "Failed to setup bus: %s\n", strerror(-r));
		return r;
	}

	return 0;
}

/**
 * start_event_loop - Starts the D-Bus event loop to process messages.
 *
 * This function enters an infinite loop where it continuously processes D-Bus messages
 * and waits for new events.
 */
static void start_event_loop(sd_bus *bus)
{
	int r;

	printf("Starting the event loop...\n");
	while (1) {
		r = sd_bus_process(bus, NULL);
		if (r < 0) {
			fprintf(stderr, "Failed to process D-Bus bus: %s\n", strerror(-r));
			break;
		}

		r = sd_bus_wait(bus, (uint64_t)-1);
		if (r < 0) {
			fprintf(stderr, "Failed to wait on D-Bus: %s\n", strerror(-r));
			break;
		}
	}
}

/**
 * run_server - Initializes the D-Bus connection and runs the event loop.
 *
 * This function establishes a connection to the D-Bus, requests the service name,
 * sets up the D-Bus interface, and enters the event loop to handle method calls
 * and signals. It ensures the bus is properly initialized and cleaned up after use.
 *
 * The function exits the program if any step fails.
 */
static void run_server(void)
{
	sd_bus *bus = NULL;
	int err;

	err = create_bus_connection(&bus);
	if (err)
		exit(EXIT_FAILURE);

	err = request_dbus_name(bus);
	if (err) {
		sd_bus_unref(bus);
		exit(EXIT_FAILURE);
	}

	err = setup_dbus_bus(bus);
	if (err) {
		sd_bus_unref(bus);
		exit(EXIT_FAILURE);
	}

	start_event_loop(bus);

	sd_bus_unref(bus);
}

/**
 * start_server - Starts the D-Bus server in either foreground or background mode.
 *
 * This function initiates the server by calling `run_server()`. If the `foreground`
 * parameter is true, the server runs in the foreground. If false, it forks a child
 * process to run the server in the background.
 */
static void start_server(int foreground)
{
	printf("Starting server in %s mode.\n", foreground ? "foreground" : "background");
	if (foreground) {
		run_server();
		exit(EXIT_SUCCESS);
	} else if (fork() == 0) {
		run_server();
		exit(EXIT_SUCCESS);
	}
}

/**
 * validate_arguments - Validates command-line arguments for the program.
 */
static void validate_arguments(int argc, char **argv)
{
	if (argc >= 2)
		return;

	fprintf(stderr, "Usage: %s --server | --enable | --disable | --get | --listen\n", argv[0]);
	exit(EXIT_FAILURE);
}

/**
 * handle_server_command - Starts the server in the foreground.
 */
static void handle_server_command(void)
{
	start_server(1);
	exit(EXIT_SUCCESS);
}

/**
 * connect_to_bus - Establishes a connection to the D-Bus.
 *
 * This function creates a new D-Bus connection for communication with the system
 * or session bus, returning the bus connection handle. If the connection fails,
 * the program will exit with an error message.
 *
 * Returns a valid sd_bus pointer on success.
 */
static sd_bus *connect_to_bus(void)
{
	sd_bus *bus = NULL;
	int r;

	r = sd_bus_open_user(&bus);
	if (r < 0) {
		fprintf(stderr, "Failed to connect to D-Bus: %s\n", strerror(-r));
		exit(EXIT_FAILURE);
	}

	printf("Connected to D-Bus successfully for client commands.\n");
	return bus;
}

/**
 * handle_enable_command - Handles the "--enable" command.
 *
 * This function sends a method call to the D-Bus service to set the "enabled" state
 * to true. It handles any errors in the method call and exits the program after
 * successfully updating the state.
 *
 * Exits the program on success or failure.
 */
static void handle_enable_command(sd_bus *bus)
{
	sd_bus_error error = SD_BUS_ERROR_NULL;
	int r;

	r = sd_bus_call_method(bus, bus_name, object_path, "io.test.EnabledService", "SetEnabled",
			       &error, NULL, "i", 1);
	if (r < 0) {
		fprintf(stderr, "Failed to call SetEnabled: %s\n", error.message);
		exit(EXIT_FAILURE);
	}

	printf("Enabled set to true\n");
	exit(EXIT_SUCCESS);
}

/**
 * handle_disable_command - Handles the "--disable" command.
 *
 * This function sends a method call to the D-Bus service to set the "enabled" state
 * to false by invoking the "SetEnabled" method. It checks for errors in the method call
 * and exits the program upon successful execution.
 *
 * Exits with the status `EXIT_SUCCESS` on success or `EXIT_FAILURE` on error.
 */
static void handle_disable_command(sd_bus *bus)
{
	sd_bus_error error = SD_BUS_ERROR_NULL;
	int r;

	r = sd_bus_call_method(bus, bus_name, object_path, "io.test.EnabledService", "SetEnabled",
			       &error, NULL, "i", 0);
	if (r < 0) {
		fprintf(stderr, "Failed to call SetEnabled: %s\n", error.message);
		exit(EXIT_FAILURE);
	}

	printf("Enabled set to false\n");
	exit(EXIT_SUCCESS);
}

/**
 * handle_get_command - Handles the "--get" command for the client.
 *
 * This function sends a "GetEnabled" method call to the D-Bus service and processes
 * the response by reading the current value of the "enabled" state. It then prints
 * the current state to the console.
 *
 * Exits the program on success or failure.
 */
static void handle_get_command(sd_bus *bus)
{
	sd_bus_error error = SD_BUS_ERROR_NULL;
	sd_bus_message *m = NULL;
	int current_state;
	int r;

	r = sd_bus_call_method(bus, bus_name, object_path, "io.test.EnabledService", "GetEnabled",
			       &error, &m, "");
	if (r < 0) {
		fprintf(stderr, "Failed to call GetEnabled: %s\n", error.message);
		exit(EXIT_FAILURE);
	}

	r = sd_bus_message_read(m, "i", &current_state);
	if (r < 0) {
		fprintf(stderr, "Failed to read GetEnabled response: %s\n", strerror(-r));
		exit(EXIT_FAILURE);
	}

	printf("Current enabled state: %d\n", current_state);
	sd_bus_message_unref(m);
	exit(EXIT_SUCCESS);
}

/**
 * handle_listen_command - Listens for the "EnabledChanged" signal on the D-Bus.
 *
 * This function adds a match to the D-Bus to listen for the "EnabledChanged"
 * signal from the "io.test.EnabledService" interface. Upon receiving the signal,
 * it triggers the signal handler. The function enters a loop to process D-Bus messages
 * and wait for new events until the service is stopped.
 *
 * Exits the program on failure or after listening indefinitely for signals.
 */
static void handle_listen_command(sd_bus *bus)
{
	sd_bus_slot *slot = NULL;
	int r;

	r = sd_bus_add_match(
		bus, &slot,
		"type='signal',interface='io.test.EnabledService',member='EnabledChanged'",
		signal_handler, bus);
	if (r < 0) {
		fprintf(stderr, "Failed to add match for EnabledChanged: %s\n", strerror(-r));
		exit(EXIT_FAILURE);
	}

	printf("Listening for EnabledChanged signals...\n");
	while (1) {
		r = sd_bus_process(bus, NULL);
		if (r < 0) {
			fprintf(stderr, "Failed to process D-Bus bus: %s\n", strerror(-r));
			break;
		}

		r = sd_bus_wait(bus, (uint64_t)-1);
		if (r < 0) {
			fprintf(stderr, "Failed to wait on D-Bus: %s\n", strerror(-r));
			break;
		}
	}

	sd_bus_unref(bus);
	exit(EXIT_SUCCESS);
}

int main(int argc, char **argv)
{
	sd_bus *bus = NULL;

	validate_arguments(argc, argv);

	if (strcmp(argv[1], "--server") == 0)
		handle_server_command();

	bus = connect_to_bus();

	if (strcmp(argv[1], "--enable") == 0)
		handle_enable_command(bus);
	else if (strcmp(argv[1], "--disable") == 0)
		handle_disable_command(bus);
	else if (strcmp(argv[1], "--listen") == 0)
		handle_listen_command(bus);
	else if (strcmp(argv[1], "--get") == 0)
		handle_get_command(bus);

	fprintf(stderr, "Unknown option: %s\n", argv[1]);
	return EXIT_FAILURE;
}
```

The program sets up a D-Bus interface, allowing clients to interact with the `Enabled` property through two methods (`GetEnabled` and `SetEnabled`)
and listen for `EnabledChanged` signals.

## Breaking It Down: Step-by-Step Guide

Now that we have a complete overview of the SDBus program, let’s break it down step by step to understand how each component works and how they come together
to form a fully functional D-Bus service.

### Step 1: Setting Up the Basics

The first step involves initializing the D-Bus connection and registering the service name.
The `sd_bus_open_user` function creates a connection to the D-Bus, and `sd_bus_request_name` registers a unique name for the service.

```c
sd_bus *bus = NULL;
int r;

r = sd_bus_open_user(&bus);
if (r < 0) {
	fprintf(stderr, "Failed to connect to D-Bus: %s\n", strerror(-r));
	exit(EXIT_FAILURE);
}

r = sd_bus_request_name(bus, bus_name, 0);
if (r < 0) {
	fprintf(stderr, "Failed to request D-Bus name '%s': %s\n", bus_name, strerror(-r));
	sd_bus_unref(bus);
	exit(EXIT_FAILURE);
}
```

Here, `io.test.EnabledService` acts as the unique identifier for this service on the D-Bus.

### Step 2: Defining Methods and Signals

The SDBus API uses vtables to define methods, properties, and signals. In this example, we define two methods and one signal:

- **`SetEnabled` Method**:
  Accepts an integer (`i`) to set the value of the `enabled` variable and emits the `EnabledChanged` signal.

- **`GetEnabled` Method**:
  Returns the current value of the `enabled` variable.

- **`EnabledChanged` Signal**:
  Notifies clients whenever the `enabled` state changes.

```c
static const sd_bus_vtable example_vtable[] = {
	SD_BUS_VTABLE_START(0),
	SD_BUS_METHOD("SetEnabled", "i", SD_BUS_NO_RESULT, set_enabled, SD_BUS_VTABLE_UNPRIVILEGED),
	SD_BUS_METHOD("GetEnabled", SD_BUS_NO_ARGS, "i", get_enabled, SD_BUS_VTABLE_UNPRIVILEGED),
	SD_BUS_SIGNAL("EnabledChanged", "i", 0),
	SD_BUS_VTABLE_END,
};
```

This vtable maps method and signal names to their respective handlers.

### Step 3: Handling Method Calls

Each method handler receives the following parameters:

- **`sd_bus_message *m`**: Represents the incoming message.
- **`void *userdata`**: Additional user-defined data (e.g., the bus connection).
- **`sd_bus_error *ret_error`**: Used to propagate errors.

The `SetEnabled` method updates the `enabled` state and emits the `EnabledChanged` signal:

```c
static int set_enabled(sd_bus_message *m, void *userdata, sd_bus_error *ret_error)
{
	sd_bus *bus = NULL;
	int new_value;
	int r;

	bus = userdata;

	r = sd_bus_message_read(m, "i", &new_value);
	if (r < 0)
		return r;

	enabled = new_value;
	r = sd_bus_emit_signal(bus, object_path, "io.test.EnabledService", "EnabledChanged", "i",
			       enabled);
	if (r < 0) 
		return r;

	return sd_bus_reply_method_return(m, NULL);
}
```

The `GetEnabled` method simply replies with the current value of `enabled`:

```c
static int get_enabled(sd_bus_message *m, void *userdata, sd_bus_error *ret_error)
{
	return sd_bus_reply_method_return(m, "i", enabled);
}
```

### Step 4: Registering the Interface

Once the vtable is defined, it must be registered with the D-Bus. This is achieved using `sd_bus_add_object_vtable`:

```c
static int setup_bus(sd_bus *bus)
{
	sd_bus_slot *slot = NULL;
	int r;

	r = sd_bus_add_object_vtable(bus, &slot, object_path, "io.test.EnabledService",
				     example_vtable, bus);
	if (r < 0)
		return r;

	return 0;
}
```

The `object_path` specifies where the interface is exposed on the bus, and `"io.test.EnabledService"` identifies the interface.

### Step 5: Running the Server

The server enters an event loop to process incoming messages:

```c
while (1) {
	r = sd_bus_process(bus, NULL);
	if (r < 0)
		break;

	r = sd_bus_wait(bus, (uint64_t)-1);
	if (r < 0)
		break;
}
```

Here, `sd_bus_process` handles pending messages, and `sd_bus_wait` waits for new events. This loop ensures that the service remains responsive.

### Step 6: Setting the State

The state of the `enabled` variable can be modified by sending a `SetEnabled` method call to the D-Bus service.
This allows clients to set the `enabled` state to either `true` (1) or `false` (0).
When the state is updated, the service emits an `EnabledChanged` signal to notify any interested clients of the change.

```c
sd_bus_error error = SD_BUS_ERROR_NULL;
int value;
int r;

value = 1;
r = sd_bus_call_method(bus, bus_name, object_path, "io.test.EnabledService", "SetEnabled",
                       &error, NULL, "i", value);
if (r < 0)
	exit(EXIT_FAILURE);

exit(EXIT_SUCCESS);
```

This updates the `enabled` state based on the provided value via the D-Bus.
The server will emit the signal to notify other clients about the change.

### Step 7: Retrieving the State

To retrieve the current value of the `enabled` state, clients can call the `GetEnabled` method.
This method sends back the current value of the `enabled` variable.

```c
static void handle_get_command(sd_bus *bus)
{
	sd_bus_error error = SD_BUS_ERROR_NULL;
	sd_bus_message *m = NULL;
	int current_state;
	int r;

	r = sd_bus_call_method(bus, bus_name, object_path, "io.test.EnabledService", "GetEnabled",
			       &error, &m, "");
	if (r < 0)
		exit(EXIT_FAILURE);

	r = sd_bus_message_read(m, "i", &current_state);
	if (r < 0)
		exit(EXIT_FAILURE);

	sd_bus_message_unref(m);
	exit(EXIT_SUCCESS);
}
```

This function calls the `GetEnabled` method and reads the response via D-Bus.

### Step 8: Listening for Signals

Clients can listen for changes to the `enabled` state by subscribing to the `EnabledChanged` signal.
When the `enabled` state is modified, the service emits this signal, which is received by any client that is subscribed to it.

The `signal_handler` function is called whenever the `EnabledChanged` signal is received.
This function processes the signal, extracting the new value and printing it to the console.

```c
static int signal_handler(sd_bus_message *m, void *userdata, sd_bus_error *ret_error)
{
	int new_value;
	int r;

	r = sd_bus_message_read(m, "i", &new_value);
	if (r < 0)
		return r;

	return 0;
}
```

The client subscribes to the `EnabledChanged` signal by calling `sd_bus_add_match` and enters an event loop to wait for incoming signals.

```c
static void handle_listen_command(sd_bus *bus)
{
	sd_bus_slot *slot = NULL;
	int r;

	r = sd_bus_add_match(
		bus, &slot,
		"type='signal',interface='io.test.EnabledService',member='EnabledChanged'",
		signal_handler, bus);
	if (r < 0)
		exit(EXIT_FAILURE);

	while (1) {
		r = sd_bus_process(bus, NULL);
		if (r < 0)
			break;

		r = sd_bus_wait(bus, (uint64_t)-1);
		if (r < 0)
			break;
	}

	sd_bus_unref(bus);
	exit(EXIT_SUCCESS);
}
```

This function listens for the `EnabledChanged` signal and processes any incoming messages, allowing the client to react to changes in the `enabled` state.


## Compiling a SDBus Program

To compile the SDBus program, a simple `Makefile` like the example below will suffice:

```make
CC = gcc
CFLAGS = $(shell pkg-config --cflags libsystemd)
LDFLAGS = $(shell pkg-config --libs libsystemd)
TARGET = sdbus_service
SRC = sdbus_service.c

$(TARGET): $(SRC)
	$(CC) -o $(TARGET) $(SRC) $(CFLAGS) $(LDFLAGS)

clean:
	rm -f $(TARGET)
```

The correct `CFLAGS` and `LDFLAGS` can be determined by simply calling `pkg-config` on most systems.

To compile, simply run `make` in the directory containing this Makefile and source files.
The `make` command will call the compiler with the appropriate flags and create the `sdbus_service` executable.

To clean up the compiled files, you can run `make clean`, which will remove the generated binary.

> License: CC BY 4.0

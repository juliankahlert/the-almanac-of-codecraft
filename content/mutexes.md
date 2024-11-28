# Mutexes
Mutexes, or **mutual exclusions**, are synchronization primitives used to manage access to shared resources.
They prevent **race conditions**, which can occur when multiple processes attempt to access and modify the same data simultaneously.

Mutexes are simple synchronization tools with (in their purest from) a binary state: locked and unlocked.
Only one process can hold the lock at any given time.
If a process tries to lock a mutex that is already held by another, it will block (wait) until the mutex is unlocked.
Threfore mutualy exclusive access to the critical section is guaranteed.

## How Mutexes Work

Mutexes rely on **hardware** support to ensure synchronization.
At their core, mutexes use **atomic operations**, which are provided by modern CPUs, to guarantee that certain memory updates are performed without interruption.
These atomic operations make sure that only one process can acquire the mutex at a time, preventing **race conditions**.

### Atomic Operations and CPU Support

A **mutex** relies on atomic instructions such as **Compare-and-Swap (CAS)** or **Test-and-Set** to control access to a critical section.
These atomic operations are supported natively by most modern CPUs.

For example, on x86 architectures, instructions like `lock xchg` and `cmpxchg` are used to perform atomic operations
to ensure that memory is not accessed concurrently by multiple processes.

#### Example Using GCC Atomic Intrinsics

In user-space programs, GCC provides **intrinsics** that map directly to these atomic CPU instructions.
Here's an example of a spinlock-based mutex using GCC atomic intrinsics:

```c
#include <stdatomic.h>
#include <stdio.h>

struct mutex {
	int lock;
};

/*
 * mutex_init - Initialize the mutex to the unlocked state (0)
 */
void mutex_init(struct mutex *m)
{
	/* Set lock to 0 (unlocked) */
	__atomic_store_n(&m->lock, 0, __ATOMIC_SEQ_CST);
}

/*
 * mutex_lock - Lock the mutex (spin until the lock is available)
 */
void mutex_lock(struct mutex *m)
{
	/* Busy-wait until the lock is available */
	while (__atomic_exchange_n(&m->lock, 1, __ATOMIC_ACQUIRE) == 1);
}

/*
 * mutex_unlock - Unlock the mutex (set the lock to 0)
 */
void mutex_unlock(struct mutex *m)
{
	/* Release the lock */
	__atomic_store_n(&m->lock, 0, __ATOMIC_RELEASE);
}

int main()
{
	struct mutex mutex;
	mutex_init(&mutex);

	printf("Locking mutex...\n");
	mutex_lock(&mutex);
	printf("Mutex locked!\n");

	printf("Unlocking mutex...\n");
	mutex_unlock(&mutex);
	printf("Mutex unlocked!\n");

	return 0;
}
```

In this example, two primary GCC atomic intrinsics are used: **`__atomic_exchange_n`** and **`__atomic_store_n`**.
These intrinsics provide the foundation to the locking and unlocking behavior of the mutex.
The `__atomic_exchange_n` intrinsic, used in the `mutex_lock` function, performs an atomic exchange of the `lock` variable,
setting its value to `1` (indicating the mutex is locked) and returning the previous value of the `lock`.
If the previous value is `1`, it means that the mutex was already locked by another process,
and the current process must continue spinning in the loop until the lock becomes available.
This busy-waiting mechanism is a simple form of a spinlock.

The `__atomic_store_n` intrinsic, used in both the `mutex_init` and `mutex_unlock` functions, sets the `lock` variable to the unlocked state.
The intrinsic ensures that this operation is performed atomically.

The `__ATOMIC_ACQUIRE` and `__ATOMIC_RELEASE` memory orderings ensure that all memory operations are properly ordered with respect to the mutex operations.
Specifically, `__ATOMIC_ACQUIRE` ensures that all memory reads and writes performed by the current process are not reordered before acquiring the lock, and `__ATOMIC_RELEASE` ensures that memory operations are completed before releasing the lock.

### Integration with the Operating System

While atomic operations provide the foundation for mutexes, higher-level mutex implementations in libraries such as the Linux kernel or the C standard library
build on these atomic operations to manage scheduling and blocking.
When a process cannot immediately acquire the lock, the operating system typically puts the process to sleep and wakes it up later when the lock is available.
This prevents wasted CPU cycles compared to busy-waiting.

## Examples

### Including Mutex Headers

To use mutexes, include the appropriate header file based on your programming environment:

- **Kernel**:

    ```c
    #include <linux/mutex.h>
    ```

- **Standard Library**:

    ```c
    #include <threads.h>
    ```

### Declaring a Mutex

Declare a mutex for later use. The structure differs slightly between kernel and user-space contexts:

- **Kernel**:

    ```c
    struct mutex my_mutex;
    ```

- **Standard Library**:

    ```c
    mtx_t my_mutex;
    ```

### Initialization

Before using a mutex, it must be initialized to set it to an unlocked state:

- **Kernel**:

    ```c
    mutex_init(&my_mutex);
    ```

- **Standard Library**:

    ```c
    mtx_init(&my_mutex, mtx_plain);
    ```

> Note: The standard library mutex supports multiple types of behavior. Use `mtx_plain` for a basic mutex, or explore options like `mtx_recursive` for advanced use cases.

### Locking and Unlocking

To safely access a shared resource, lock the mutex before access and unlock it afterward to allow other processes to proceed:

- **Kernel**:

    ```c
    mutex_lock(&my_mutex);
    /* Access shared resource */
    mutex_unlock(&my_mutex);
    ```

- **Standard Library**:

    ```c
    mtx_lock(&my_mutex);
    /* Access shared resource */
    mtx_unlock(&my_mutex);
    ```

> **Kernel-Specific Note**: Mutexes cannot be used in interrupt contexts because they may block execution. For such cases, consider using spinlocks or other non-blocking synchronization mechanisms.

---

### Try Lock

Sometimes, you may want to attempt locking a mutex without blocking if it is already held by another process. This is known as a **try lock** and is useful for non-blocking operations.

- **Kernel**:

    ```c
    if (mutex_trylock(&my_mutex)) {
        /* Successfully acquired the lock */
        /* Access shared resource */
        mutex_unlock(&my_mutex);
    } else {
        /* Lock was not available */
        pr_info("Mutex is already locked\n");
    }
    ```

- **Standard Library**:

    ```c
    if (mtx_trylock(&my_mutex) == thrd_success) {
        /* Successfully acquired the lock */
        /* Access shared resource */
        mtx_unlock(&my_mutex);
    } else {
        /* Lock was not available */
        printf("Mutex is already locked\n");
    }
    ```

### Cleaning Up

Once a mutex is no longer needed, destroy it to release associated resources.
This step is especially important in long-running programs to avoid resource leaks:

- **Kernel**:

    ```c
    mutex_destroy(&my_mutex);
    ```

- **Standard Library**:

    ```c
    mtx_destroy(&my_mutex);
    ```

## Advanced Use Cases

### Acquiring Multiple Mutexes

In some cases, an operation may require acquiring multiple mutexes simultaneously.
This introduces a risk of **deadlocks**, where two or more processes are waiting indefinitely for mutexes held by one another. 

#### Deadlock Prevention with Locking Order

One effective way to avoid deadlocks is to always acquire mutexes in a consistent order across all processes.
For example, if multiple processes need to acquire `mutex_a` and `mutex_b`, always lock `mutex_a` first, followed by `mutex_b`.

- **Kernel**:

    ```c
    mutex_lock(&mutex_a);
    mutex_lock(&mutex_b);
    /* Access shared resources guarded by mutex_a and mutex_b */
    mutex_unlock(&mutex_b);
    mutex_unlock(&mutex_a);
    ```

- **Standard Library**:

    ```c
    mtx_lock(&mutex_a);
    mtx_lock(&mutex_b);
    /* Access shared resources guarded by mutex_a and mutex_b */
    mtx_unlock(&mutex_b);
    mtx_unlock(&mutex_a);
    ```

By maintaining a strict locking order the possibility of circular dependencies eliminated.
This ensures that processes never block each other indefinitely.


> License: CC BY 4.0


# Traits in C: A Guide to Polymorphism without Inheritance

Polymorphism is a cornerstone of programming, allowing to write flexible and reusable code.
Typically, languages like C++ and Java implement polymorphism through classes and inheritance.
However, this isn't the only way to achieve polymorphism; traits provide a powerful alternative that is particularly effective in C.
This article delves into what traits are, how they compare to inheritance, and how to use them in C, illustrated by an example involving crabs and fish.

## Traits vs. Inheritance

Traits are a programming construct that allows for the definition of shared behavior across different types without enforcing a strict hierarchy.
Unlike traditional inheritance where a subclass inherits attributes and methods from a superclass, traits focus on defining a set of behaviors or capabilities that types can implement in their own way.

In languages that support traits, such as Rust, traits can be thought of as interfaces that define method signatures without implementing them.
Types that implement a trait must provide concrete implementations for these methods.
This allows for polymorphism, as the same method can operate on different types that implement the same trait without knowing their concrete types at compile time.

In C, while traits are not a built-in feature, they can be simulated using function pointers within structures.
The polymorphic behavior is achieved by defining common traits (like swimmer or grabber) and allowing different types (like crab and fish) to implement these traits with their own logic.

## Why Traits are Objectively Superior to Inheritance

Traits allow for a more flexible and modular design than traditional inheritance.
With traits, you can mix multiple traits into a single type without the constraints of a rigid class hierarchy.
This means you can combine behaviors without worrying about the complexity introduced by inheritance trees.

Inheritance leads to issues known as the "fragile base class" problem, where changes in a base class can inadvertently break derived classes.
Traits avoid this problem by promoting composition over inheritance.
When developing with traits, behaviors are explicit and contained within their respective types.
Any required change in behavior can be made within the trait itself or through different trait implementations without affecting other types.

Traits improve the clarity of your code by making it easier to understand the capabilities of a type.
Whereas inheritance can obscure behavior through layers of abstraction, traits define clear and specific interfaces that types must adhere to.
This leads to cleaner and more readable codebases.

## Traits in C: A Practical Example

In the following example, we define two types (crab and fish), each implementing shared behaviors through traits.
We define swimmer behaviors, item characteristics, and grabbing capabilities.

### Example Code Overview

```C
#include <stdio.h>
#include <stdlib.h>
#include <stddef.h>

#define container_of(ptr, type, member) ({                      \
        const typeof( ((type *)0)->member ) *__mptr = (ptr);    \
        (type *)((char *)__mptr - offsetof(type,member));})

/********** Trait declarations **********/

/* Define the swimmer trait structure */
struct swimmer {
	void (*swim)(struct swimmer *self);
};

/* Define the item structure */
struct item {
	int (*edible)(struct item *self);
	const char *(*item_name)(struct item *self);
};

/* Define the grabber trait structure */
struct grabber {
	void (*grab)(struct grabber *self, struct item *grabbable);
};

/* Macros for trait declarations */
#define SWIMMER_TRAIT struct swimmer _swimmer_trait
#define GRABBER_TRAIT struct grabber _grabber_trait
#define ITEM_TRAIT struct item _item_trait

/* Wrapper macros for trait functions */
#define swimmer_swim(swimmer) do {                                  \
	if ((swimmer) && (swimmer)->_swimmer_trait.swim)                \
		(swimmer)->_swimmer_trait.swim(&(swimmer)->_swimmer_trait); \
} while (0)

#define grabber_grab(grabber, item) do {                                      \
	if ((grabber) && (grabber)->_grabber_trait.grab)                          \
		(grabber)->_grabber_trait.grab(&(grabber)->_grabber_trait,            \
		                                (item)? &(item)->_item_trait : NULL); \
} while (0)

/********** Animal definitions **********/

/* Define the crab structure that implements swimmer and grabber traits */
struct crab {
	SWIMMER_TRAIT;
	GRABBER_TRAIT;
};

#define swimmer_to_crab(P) container_of((P), struct crab, _swimmer_trait)
#define grabber_to_crab(P) container_of((P), struct crab, _grabber_trait)

/* Implementation of the crab's swim behavior */
static void crab_swim(struct swimmer *self)
{
	struct crab *c = NULL;

	if (!self)
		return;

	c = swimmer_to_crab(self);

	printf("Crab %p is swimming!\n", c);
}

/* Implementation of the crab's grab behavior */
static void crab_grab(struct grabber *self, struct item *grabbable)
{
	const char *name = NULL;
	struct crab *c = NULL;

	if (!self)
		return;

	c = grabber_to_crab(self);

	name = grabbable->item_name(grabbable);

	printf("Crab %p is grabbing a %s!\n", c, name);
}

/* Initialize the trait structures */
struct swimmer crab_swim_trait = {
	.swim = crab_swim,
};

struct grabber crab_grab_trait = {
	.grab = crab_grab,
};

/* Create a crab instance */
struct crab *create_crab(void)
{
	struct crab *c = calloc(1, sizeof(struct crab));
	if (!c)
		return NULL;

	c->_swimmer_trait = crab_swim_trait;
	c->_grabber_trait = crab_grab_trait;

	return c;
}


/* Define the fish structure that implements swimmer and item traits */
struct fish {
	SWIMMER_TRAIT;
	ITEM_TRAIT;
};

#define swimmer_to_fish(P) container_of((P), struct fish, _swimmer_trait)
#define item_to_fish(P) container_of((P), struct fish, _item_trait)

/* Implementation of the fish's swim behavior */
static void fish_swim(struct swimmer *self)
{
	struct fish *f = NULL;

	if (!self)
		return;

	f = swimmer_to_fish(self);

	printf("Fish %p is swimming!\n", f);
}

/* Implementation of the fish's edible method */
static int fish_edible(struct item *self)
{
	return 1; 
}

/* Implementation of the fish's name method */
static const char *fish_item_name(struct item *self)
{
	return "Fish";
}

struct swimmer fish_swim_trait = {
	.swim = fish_swim,
};

struct item fish_item_trait = {
	.edible = fish_edible,
	.item_name = fish_item_name,
};

/* Create a fish instance */
struct fish *create_fish(void)
{
	struct fish *f = calloc(1, sizeof(struct fish));
	if (!f)
		return NULL;

	f->_swimmer_trait = fish_swim_trait;
	f->_item_trait = fish_item_trait;

	return f;
}

/* Example usage function */
static void example_usage(void)
{
	struct crab *my_crab = create_crab();
	struct fish *my_fish = create_fish();
    
	if (my_crab && my_fish) {
		swimmer_swim(my_crab);
		swimmer_swim(my_fish);
		grabber_grab(my_crab, my_fish);  /* Crab grabs the fish */
	}

	free(my_crab);
	free(my_fish);
}

/* Main function */
int main(void)
{
	printf("Crab and Fish Simulation\n");
	example_usage();
	return 0;
}
```

- **Trait Structures:**
    We define structures (swimmer, grabber, and item) that encapsulate behaviors through function pointers.
    Each type implements their behaviors through these function pointers.

- **Creating Types**:
    The crab and fish structures include trait pointers which allow them to implement swim and grab behaviors.
    Each type can have its own unique implementation while still adhering to the shared interfaces.

- **Using Macros**:
    Convenience macros such as `swimmer_swim` and `grabber_grab` are provided to safely call the respective methods,
    encapsulating the logic of trait method invocation.

- **Main Logic**:
    The `example_usage` function demonstrates creating a crab and a fish, swimming, and grabbing the fish, showcasing polymorphism in action.


### Step-By-Step

Using traits in C involves several systematic steps that allow you to define, implement, and utilize shared behaviors between different types.
Here’s a breakdown of the necessary steps:

- Define Trait Structures:
    Create structures that define the traits you want to use.
    Each trait structure contains function pointers for the behaviors associated with that trait.

- Define Type Structures:
    Create your main data types (like crab and fish) that will implement the traits.
    Each type should include pointer fields to the corresponding trait structures.

- Implement Trait Behaviors:
    Write the actual functions that implement the behaviors for each trait.
    These functions will be assigned to the function pointers defined in the trait structures.

### Detailed Breakdown for the Fish

Let’s build the fish type with the traits defined above.

#### Step 1: Define Trait Structures

Define the swimmer and item structures as our traits:

```C
/* Define the swimmer trait structure */
struct swimmer {
	void (*swim)(struct swimmer *self);
};

/* Define the item structure */
struct item {
	int (*edible)(struct item *self);
	const char *(*item_name)(struct item *self);
};

/* Macros for fish trait declaration */
#define SWIMMER_TRAIT struct swimmer _swimmer_trait
#define ITEM_TRAIT struct item _item_trait
```

#### Step 2: Define the Fish Structure

Create the structure for the fish type, including the traits:

```C
struct fish {
	SWIMMER_TRAIT;
	ITEM_TRAIT;
};

#define swimmer_to_fish(P) container_of((P), struct fish, _swimmer_trait)
#define item_to_fish(P) container_of((P), struct fish, _item_trait)
```

#### Step 3: Implement Trait Behaviors

Write the functions that will implement the swimmer and item behaviors for the fish:

```C
/* Implementation of the fish's swim behavior */
static void fish_swim(struct swimmer *self)
{
	struct fish *f = NULL;

	if (!self)
		return;

	f = swimmer_to_fish(self);

	printf("Fish %p is swimming!\n", f);
}

/* Implementation of the fish's edible method */
static int fish_edible(struct item *self)
{
	return 1; 
}

/* Implementation of the fish's name method */
static const char *fish_item_name(struct item *self)
{
	return "Fish";
}
```

#### Step 4: Initialize the Trait Structures

Allocate and initialize the trait structures:

```C
struct swimmer fish_swim_trait = {
	.swim = fish_swim,
};

struct item fish_item_trait = {
	.edible = fish_edible,
	.item_name = fish_item_name,
};
```

#### Step 5: Create an Instance

Write a function to create a new fish, initializing its traits:

```C
/* Create a fish instance */
struct fish *create_fish(void)
{
	struct fish *f = calloc(1, sizeof(struct fish));
	if (!f)
		return NULL;

	f->_swimmer_trait = fish_swim_trait;
	f->_item_trait = fish_item_trait;

	return f;
}
```

#### Step 6: Example Usage

Finally, in your `main()` function or another function, create a fish and use its traits:

```C
int main(void)
{
	struct fish *my_fish = create_fish();
	if (!my_fish)
		return -ENOMEM;

	swimmer_swim(my_fish);

	free(my_fish);

	return 0;
}
```

### Interaction of Different Trait Objects

In our scenario, we can mimic how a crab interacts with a fish through the grabbing mechanism defined by the grabber trait.
This interaction allows the crab to utilize its grabbing capability on any item implementing the item trait, such as our fish.

```C
struct crab *my_crab = create_crab();
struct fish *my_fish = create_fish();

if (my_crab && my_fish) {
	swimmer_swim(my_crab); /* Crab swims */
	swimmer_swim(my_fish); /* Fish swims */
	grabber_grab(my_crab, my_fish); /* Crab grabs the fish */
}
```

The `grabber_grab` macro is called with `my_crab`, which safely invokes the `grab` method implemented in `crab`.
It also accepts `my_fish`  as an argument, allowing it to interface with any object that implements the `item` trait.
The macro checks both the grabber and item for valid pointers and their respective functions, ensuring safety before invoking methods.
This encapsulation allows for flexible designs, where you can add more items without changing the crab implementation.

By separating behavior (navigation and grabbing) into traits, the code remains clean, understandable, and modular.
Each object knows only about the traits it can utilize, reducing tight coupling and improving maintainability.

## Conclusion

The provided C example demonstrates the use of traits to achieve polymorphism through structures and function pointers.
The code starts by defining trait structures: swimmer, item, and grabber, with each structure containing function pointers for specific behaviors.
Macros like `SWIMMER_TRAIT`, `GRABBER_TRAIT`, and `ITEM_TRAIT` enable consistent naming and easy integration of these traits into our animal types.

The crab and fish structures are defined to incorporate these traits, allowing them to perform swimming and grabbing actions.
The crab can swim via the `crab_swim` function, while its grabbing behavior is implemented in the `crab_grab` function, which accesses the item being grabbed through the item trait.
The fish structure similarly implements swimming and item characteristics with functions like `fish_swim`, `fish_edible`, and `fish_item_name`.

Trait structures are initialized to link the functions to their behaviors, and memory allocation for instances of the crab and fish is handled by `create_crab` and `create_fish` functions, which also set the trait pointers.

This showcases how traits can provide polymorphism and flexible interactions between types in C, while promoting a clean, modular design that avoids mnessy inheritance.

> License: CC BY 4.0

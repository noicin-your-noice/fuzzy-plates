# License Plate Search

Look up license plates in a list, matching even when characters just look alike, like O/0, B/8, etc.

## How to use

Use the site [here](https://salt67.github.io/fuzzy-plates/), or download [fuzzy-plates.html](dist/fuzzy-plates.html) to a file.

Paste in data from a spreadsheet that has a list of vehicles with license plates. If there is a column containing "plate", that is the column that will be searched. If there are columns containing "color", "make", or "model" they will be used to summarize the color, make, and model of the vehicles. 

![usage](https://github.com/user-attachments/assets/d1607dbd-d119-47a7-9358-7aafb14ddf8f)

Here is some sample data you can copy and paste in to try it out:

```
License Plate	State	Color	Make	Model	Notes
FP21350	AL	Black	Toyota	Camry	
JRD-459	AK	Black	Jeep	Wrangler	
TEX 7A3	AZ		Chevy	Corvette	
MVN-210	AR	White	Subaru	Impreza	
Q0Q-8B8	CA	Turquoise	Chevy	Bolt	
L9Z-441	CO	Gray	Nissan	Altima	Baby on board sticker
L9Z 441	CO	Gray	Nissan	Sedan	
HRT520	CT	Black	Chevy	Silverado	
TEX7A3	AZ	White		Sports Car	
KLM-007	DE	White	Toyota	Camry	
```
